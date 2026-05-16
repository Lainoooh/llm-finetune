"""
Task management router.
"""

import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.models.task import TaskRepo
from app.models.indicator import AnnualReportFileRepo
from app.models.conversation import ConversationMemberRepo
from app.models.model import ModelRepo
from app.schemas.common import TaskCreateRequest, TaskResponse
from app.middleware.auth import get_current_user

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/conversations/{conv_id}/tasks", response_model=dict)
def create_task(
    conv_id: str,
    req: TaskCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new review task in a conversation."""
    # Check conversation access
    role = ConversationMemberRepo.get_user_role(conv_id, user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate model if specified
    if req.model_id:
        model = ModelRepo.get_by_id(req.model_id)
        if not model or not model["is_active"]:
            raise HTTPException(status_code=400, detail="Invalid or inactive model")

    task_id = TaskRepo.create(
        conversation_id=conv_id,
        user_id=user["id"],
        company_name=req.company_name,
        report_year=req.report_year,
        model_id=req.model_id,
        metrics_json=req.metrics_json,
    )
    return {"id": task_id, "status": "pending"}


@router.get("/tasks/{task_id}", response_model=dict)
def get_task(task_id: str, user: dict = Depends(get_current_user)):
    """Get task details."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return task


@router.get("/conversations/{conv_id}/tasks", response_model=list)
def list_tasks(
    conv_id: str,
    user: dict = Depends(get_current_user),
):
    """List tasks in a conversation."""
    role = ConversationMemberRepo.get_user_role(conv_id, user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")
    return TaskRepo.list_by_conversation(conv_id)


@router.delete("/tasks/{task_id}", response_model=dict)
def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    """Delete a task."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    TaskRepo.delete(task_id)
    return {"message": "Task deleted"}

@router.post("/upload-temp", response_model=dict)
async def upload_temp(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a PDF file temporarily (before task creation). Returns a temp_file_id."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    temp_id = str(uuid.uuid4())
    file_name = f"temp_{temp_id}.pdf"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "temp_file_id": temp_id,
        "file_name": file.filename,
        "file_path": file_path,
        "file_size": len(content),
    }


@router.post("/tasks/{task_id}/link-temp-file", response_model=dict)
async def link_temp_file(
    task_id: str,
    req: dict,
    user: dict = Depends(get_current_user),
):
    """Link a previously uploaded temp file to a task."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    temp_file_id = req.get("temp_file_id")
    original_name = req.get("file_name", "report.pdf")
    if not temp_file_id:
        raise HTTPException(status_code=400, detail="temp_file_id is required")

    temp_path = os.path.join(UPLOAD_DIR, f"temp_{temp_file_id}.pdf")
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="Temp file not found or expired")

    # Rename to task-based filename
    final_name = f"{task_id}.pdf"
    final_path = os.path.join(UPLOAD_DIR, final_name)
    os.rename(temp_path, final_path)

    file_size = os.path.getsize(final_path)
    file_id = AnnualReportFileRepo.create(
        task_id=task_id,
        file_path=final_path,
        file_name=original_name,
        file_size=file_size,
    )
    TaskRepo.update(task_id, report_file_id=file_id)

    return {"file_id": file_id, "file_path": final_path, "message": "File linked"}


@router.post("/tasks/{task_id}/upload", response_model=dict)
async def upload_report(
    task_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload an annual report PDF file."""
    task = TaskRepo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Save file
    file_ext = ".pdf"
    file_name = f"{task_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_id = AnnualReportFileRepo.create(
        task_id=task_id,
        file_path=file_path,
        file_name=file.filename,
        file_size=len(content),
    )

    TaskRepo.update(task_id, report_file_id=file_id)

    return {"file_id": file_id, "file_path": file_path, "message": "File uploaded"}

