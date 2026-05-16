"""
Workflow router: start, resume, get status.
"""
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.models.task import TaskRepo, WorkflowStepRepo, UserDecisionRepo, InquiryLetterRepo
from app.models.risk_signal import RiskSignalInstanceRepo
from app.models.conversation import MessageRepo
from app.schemas.common import WorkflowResumeRequest
from app.middleware.auth import get_current_user
from app.services.workflow_engine import WorkflowEngine
from app.logging_config import set_trace_context

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Track running asyncio Tasks per workflow so they can be cancelled.
# Key: task_id -> asyncio.Task for the workflow loop.
# ---------------------------------------------------------------------------
_running_workflow_tasks: dict[str, asyncio.Task] = {}

# Workflow step definitions (source of truth, backend controlled)
WORKFLOW_STEPS = [
    {"index": 0, "title": '年报上传和审查',       "type": 'auto'},
    {"index": 1, "title": '指标提取',             "type": 'auto'},
    {"index": 2, "title": 'RDU风险信号分析',      "type": 'auto'},
    {"index": 3, "title": 'RDU风险信号触发判断',   "type": 'manual_risk'},
    {"index": 4, "title": '问询事项生成',          "type": 'auto'},
    {"index": 5, "title": '问询事项确认',          "type": 'manual_item'},
    {"index": 6, "title": '起草正式问询函',        "type": 'auto'},
]


@router.post("/tasks/{task_id}/start", response_model=dict)
async def start_workflow(task_id: str, user: dict = Depends(get_current_user)):
    """Start the workflow for a task."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if task["status"] == "running":
        raise HTTPException(status_code=400, detail="Workflow already running")

    # Initialize workflow steps
    for step in WORKFLOW_STEPS:
        WorkflowStepRepo.create(
            task_id=task_id,
            step_index=step["index"],
            step_name=step["title"],
            step_type=step["type"],
        )

    TaskRepo.update(task_id, status="running", current_step=0)
    
    # Start executing the workflow asynchronously
    engine = WorkflowEngine(task_id)
    conv_id = task.get("conversation_id", "")
    bg_task = asyncio.create_task(_execute_workflow_steps(engine, conv_id, start_step=0))
    _running_workflow_tasks[task_id] = bg_task
    bg_task.add_done_callback(lambda _t, tid=task_id: _running_workflow_tasks.pop(tid, None))
    
    return {"status": "running", "message": "Workflow started", "task_id": task_id}


async def _execute_workflow_steps(
    engine: WorkflowEngine,
    conversation_id: str = "",
    start_step: int = 0,
):
    """Execute workflow steps sequentially, handling pauses for manual steps."""
    # Set trace context for structured logging
    set_trace_context(engine.task_id, conversation_id)

    current_step = start_step
    step_defs = WORKFLOW_STEPS
    logger.info("工作流开始, total_steps=%d, start_step=%d", len(step_defs), start_step)
    
    while current_step < len(step_defs):
        step_title = step_defs[current_step]["title"]
        try:
            logger.info("Step %d (%s) 开始执行", current_step, step_title)
            result = await engine.execute_step(current_step)
            
            # Check if this was a manual step that just completed
            if step_defs[current_step]["type"].startswith("manual"):
                # Manual step completed, pause for user confirmation
                TaskRepo.update(engine.task_id, status="paused", current_step=current_step)
                logger.info("Step %d (%s) 暂停等待用户确认", current_step, step_title)
                return
            
            # Check result status
            if result.get("status") == "paused":
                return
            elif result.get("status") == "completed":
                _save_completion_message(engine.task_id)
                logger.info("工作流全部完成")
                return
            elif result.get("status") == "running":
                current_step = result.get("next_step", current_step + 1)
            else:
                current_step += 1
                logger.info("Step %d (%s) 完成", current_step - 1, step_title)
        except BaseException as e:
            # Catch BaseException to also handle CancelledError
            step_name = step_defs[current_step]["title"] if current_step < len(step_defs) else "unknown"
            is_cancelled = isinstance(e, asyncio.CancelledError)
            if is_cancelled:
                error_msg = f"Step {current_step} ({step_name}) 已被用户中断"
                logger.warning("%s", error_msg)
            else:
                error_msg = f"Step {current_step} ({step_name}) 失败: {type(e).__name__}"
                if str(e):
                    error_msg += f" - {str(e)[:500]}"
                logger.error("%s", error_msg)
            # Safety net: ensure step-level error is saved
            try:
                WorkflowStepRepo.update_status(engine.task_id, current_step, "failed", error_message=error_msg)
            except Exception:
                pass
            TaskRepo.update(engine.task_id, status="failed")
            return


def _save_completion_message(task_id: str):
    """Save the inquiry letter as an assistant message in the conversation."""
    try:
        task = TaskRepo.get_by_id(task_id)
        if not task:
            return
        conv_id = task.get("conversation_id")
        user_id = task.get("user_id")
        if not conv_id or not user_id:
            return

        letter = InquiryLetterRepo.get_by_task(task_id)
        if letter and letter.get("content"):
            MessageRepo.create(
                conversation_id=conv_id,
                user_id=user_id,
                role="assistant",
                content=letter["content"],
                message_type="text",
                task_id=task_id,
            )
            logger.info("Saved completion message for task %s", task_id)
    except Exception as e:
        logger.error("Failed to save completion message for task %s: %s", task_id, e)


@router.get("/tasks/{task_id}/workflow", response_model=dict)
def get_workflow_status(task_id: str, user: dict = Depends(get_current_user)):
    """Get workflow status and step details."""
    from app.services.workflow_progress import get_progress, get_completed_progress, get_streaming_text, get_all_phases
    import json as _json

    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    progress = get_progress(task_id)

    steps = WorkflowStepRepo.get_by_task(task_id)
    step_responses = []
    for s in steps:
        step_dict = {
            "step_index": s["step_index"],
            "step_name": s["step_name"],
            "step_type": s["step_type"],
            "status": s["status"],
            "logs": s.get("logs"),
            "started_at": s.get("started_at"),
            "completed_at": s.get("completed_at"),
            "error_message": s.get("error_message"),
        }
        if s["status"] == "running":
            if progress:
                step_dict["progress"] = progress
            all_phases = get_all_phases(task_id)
            if all_phases:
                step_dict["progress_phases"] = all_phases
            st = get_streaming_text(task_id)
            if st:
                step_dict["streaming_text"] = st
        elif s["status"] == "completed":
            # Completed progress snapshot (for Step 2/4 progress bar)
            cp = get_completed_progress(task_id, s["step_index"])
            if cp:
                if "phases" in cp:
                    step_dict["progress_phases"] = cp["phases"]
                    step_dict["progress"] = cp["phases"][-1] if cp["phases"] else None
                else:
                    step_dict["progress"] = cp
            # output_data summary (for per-step completion text)
            raw_output = s.get("output_data")
            if raw_output:
                try:
                    od = _json.loads(raw_output) if isinstance(raw_output, str) else raw_output
                    summary = {}
                    for key in ("indicator_count", "signal_count", "total_count",
                                "processed_count", "item_count"):
                        if od.get(key) is not None:
                            summary[key] = od[key]
                    if summary:
                        step_dict["output_summary"] = summary
                except (_json.JSONDecodeError, TypeError):
                    pass
        step_responses.append(step_dict)

    return {
        "current_step": task["current_step"],
        "status": task["status"],
        "steps": step_responses,
    }


@router.post("/tasks/{task_id}/resume", response_model=dict)
async def resume_workflow(
    task_id: str,
    req: WorkflowResumeRequest,
    user: dict = Depends(get_current_user),
):
    """Resume a paused workflow after user confirmation."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if task["status"] != "paused":
        raise HTTPException(status_code=400, detail="Workflow is not paused")

    current_step = task["current_step"]

    # Verify the step matches
    if req.step_index != current_step:
        raise HTTPException(status_code=400, detail="Step index mismatch")

    # Save user decision
    UserDecisionRepo.create(
        task_id=task_id,
        step_index=current_step,
        decision_type=req.decision,
        confirmed_ids=req.confirmed_ids,
        rejected_ids=req.rejected_ids,
        modified_data=req.modified_data,
    )

    # Apply inquiry_item edits from Step 5
    if current_step == 5 and req.modified_data:
        inquiry_items = req.modified_data.get("inquiry_items", {})
        for signal_id, new_text in inquiry_items.items():
            RiskSignalInstanceRepo.update(signal_id, inquiry_item=new_text)
        if inquiry_items:
            logger.info("Step 5: user edited %d inquiry items", len(inquiry_items))

    # Update step status
    WorkflowStepRepo.update_status(task_id, current_step, "completed")

    # Move to next step
    next_step = current_step + 1
    if next_step >= len(WORKFLOW_STEPS):
        TaskRepo.update(task_id, status="completed", current_step=next_step)
        return {"status": "completed", "message": "Workflow completed"}
    else:
        TaskRepo.update(task_id, status="running", current_step=next_step)
        WorkflowStepRepo.update_status(task_id, next_step, "running")
        
        # Continue executing workflow asynchronously
        engine = WorkflowEngine(task_id)
        conv_id = task.get("conversation_id", "")
        bg_task = asyncio.create_task(_execute_workflow_steps(engine, conv_id, start_step=next_step))
        _running_workflow_tasks[task_id] = bg_task
        bg_task.add_done_callback(lambda _t, tid=task_id: _running_workflow_tasks.pop(tid, None))
        
        return {"status": "running", "current_step": next_step}


@router.post("/tasks/{task_id}/cancel", response_model=dict)
async def cancel_workflow(task_id: str, user: dict = Depends(get_current_user)):
    """
    立即中断正在运行的工作流。
    - 通过 asyncio.Task.cancel() 触发 CancelledError，由 _execute_workflow_steps 统一处理收尾
    - 把任务整体状态标记为 failed，并写入步骤错误信息
    """
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    bg_task = _running_workflow_tasks.get(task_id)
    cancelled = False
    if bg_task and not bg_task.done():
        bg_task.cancel()
        cancelled = True
        logger.info("用户主动中断工作流 task_id=%s", task_id)

    # Best-effort: 把当前正在跑的 step 标记为 failed，整体任务标记为 failed
    try:
        current_step = task.get("current_step") or 0
        WorkflowStepRepo.update_status(
            task_id, current_step, "failed", error_message="任务已被用户中断"
        )
    except Exception:
        pass
    TaskRepo.update(task_id, status="failed")

    return {
        "status": "cancelled" if cancelled else "not_running",
        "task_id": task_id,
        "message": "任务已中断" if cancelled else "任务未在运行中，已标记为失败",
    }

@router.get("/tasks/{task_id}/steps/{step_index}/data", response_model=dict)
def get_step_data(
    task_id: str,
    step_index: int,
    user: dict = Depends(get_current_user),
):
    """Get data for a specific workflow step."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    step_data = WorkflowStepRepo.get_by_step(task_id, step_index)
    if not step_data:
        raise HTTPException(status_code=404, detail="Step not found")

    # For manual steps, also include the relevant data
    if step_index == 3:  # Risk signal confirmation
        signals = RiskSignalInstanceRepo.get_by_task(task_id)
        step_data["signals"] = signals
    elif step_index == 5:  # Inquiry item confirmation
        signals = RiskSignalInstanceRepo.get_by_task(task_id)
        step_data["signals"] = [s for s in signals if s.get("inquiry_item")]

    return step_data


@router.get("/tasks/{task_id}/indicators", response_model=list)
def get_task_indicators(task_id: str, user: dict = Depends(get_current_user)):
    """Get all indicator values for a task."""
    from app.models.indicator import IndicatorValueRepo

    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return IndicatorValueRepo.get_by_task(task_id)
