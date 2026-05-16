"""
Workflow engine service - state machine for driving the 7-step workflow.
This module contains the core logic for executing each workflow step.
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

from app.models.task import TaskRepo, WorkflowStepRepo, UserDecisionRepo
from app.models.risk_signal import RiskSignalInstanceRepo
from app.models.indicator import IndicatorValueRepo
from app.models.rdu_metrics import RDUMetricsRepo, RDURiskSignalsRepo
from app.models.category import RDUCategoryRepo
from app.models.conversation import ConversationRepo, MessageRepo
from app.models.model import ModelRepo
from app.services.llm_service import LLMService, parse_llm_content, compute_bert_f1_scores, strip_think_blocks
from app.services.pdf_parser import PDFParserService
from app.services.indicator_extractor import IndicatorExtractorService
from app.services.workflow_progress import set_phase, mark_done, clear as clear_progress, set_streaming_text
from app.database import get_db


class WorkflowEngine:
    """
    Workflow engine that drives the 7-step annual report review process.
    Each step is executed asynchronously, with manual steps pausing for user confirmation.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.task = TaskRepo.get_by_id(task_id)
        self.llm_service = LLMService()
        self.pdf_parser = PDFParserService()
        self.indicator_extractor = IndicatorExtractorService()
        self.parsed_data = None

    def get_model_for_purpose(self, purpose: str) -> Optional[dict]:
        """
        Get model configuration by purpose identifier.
        Falls back to task's assigned model or default model if not found.
        """
        # Try to find model by purpose
        model = ModelRepo.get_by_purpose(purpose)
        if model:
            return model
        
        # Fallback to task's assigned model
        if self.task and self.task.get("model_id"):
            model = ModelRepo.get_by_id(self.task["model_id"])
            if model:
                return model
        
        # Fallback to default model
        return ModelRepo.get_default()

    async def execute_step(self, step_index: int) -> dict:
        """Execute a specific workflow step."""
        handlers = {
            0: self._step_0_review_report,
            1: self._step_1_extract_indicators,
            2: self._step_2_analyze_risk_signals,
            3: self._step_3_confirm_risk_signals,
            4: self._step_4_generate_inquiry_items,
            5: self._step_5_confirm_inquiry_items,
            6: self._step_6_draft_inquiry_letter,
        }
        handler = handlers.get(step_index)
        if not handler:
            raise ValueError(f"Unknown step index: {step_index}")

        # Update step status to running
        WorkflowStepRepo.update_status(self.task_id, step_index, "running")

        try:
            result = await handler()

            # Save output data
            WorkflowStepRepo.update_status(self.task_id, step_index, "completed", output_data=result)

            # Auto continue to next step
            step_defs = self._get_step_defs()
            next_step = step_index + 1
            if next_step < len(step_defs):
                TaskRepo.update(self.task_id, current_step=next_step)
                return {"status": "running", "next_step": next_step, "data": result}

            # All steps completed
            TaskRepo.update(self.task_id, status="completed")
            return {"status": "completed", "data": result}

        except BaseException as e:
            err_msg = f"{type(e).__name__}: {str(e) or '未知错误'}"
            WorkflowStepRepo.update_status(self.task_id, step_index, "failed", error_message=err_msg)
            TaskRepo.update(self.task_id, status="failed")
            raise
        finally:
            clear_progress(self.task_id)

    async def _step_0_review_report(self) -> dict:
        """
        Step 0: 年报上传和审查
        - 解析PDF文件，提取章节内容
        """
        file_path = self.task.get("file_path")
        report_year = self.task.get("report_year")

        if not file_path or not file_path.strip():
            return {
                "message": "未找到PDF文件，跳过解析",
                "parsed": False,
                "task_id": self.task_id,
            }

        try:
            self.parsed_data = await self.pdf_parser.parse(file_path, report_year)
            # Update parse status
            from app.models.indicator import AnnualReportFileRepo
            arf = AnnualReportFileRepo.get_by_task(self.task_id)
            if arf:
                AnnualReportFileRepo.update(arf["id"], parse_status="completed")

            total_pages = self.parsed_data.get("metadata", {}).get("total_pages", 0)
            chapters_found = len(self.parsed_data.get("chapters", {}))
            missing = self.parsed_data.get("missing_chapters", [])

            return {
                "message": f"PDF解析完成（{total_pages}页，定位{chapters_found}个章节）",
                "parsed": True,
                "total_pages": total_pages,
                "chapters_found": chapters_found,
                "missing_chapters": missing,
                "task_id": self.task_id,
            }
        except Exception as e:
            logger.error("PDF解析失败: %s", e)
            from app.models.indicator import AnnualReportFileRepo
            arf = AnnualReportFileRepo.get_by_task(self.task_id)
            if arf:
                AnnualReportFileRepo.update(arf["id"], parse_status="failed", parse_error=str(e))
            raise RuntimeError(f"PDF解析失败: {e}") from e

    async def _step_1_extract_indicators(self) -> dict:
        """
        Step 1: 指标提取
        - 优先使用 JSON 传入的指标数据
        - 如果没有 JSON 数据，从PDF中提取指标
        """
        # 从 task 记录中读取 metrics_json
        metrics_json_str = self.task.get("metrics_json")
        if metrics_json_str:
            # 解析 JSON 字符串
            if isinstance(metrics_json_str, str):
                metrics_list = json.loads(metrics_json_str)
            else:
                metrics_list = metrics_json_str

            # 从 JSON 插入 indicator_values
            metric_values = self._insert_metrics_from_json(self.task_id, metrics_list)

            # 将提取的 JSON 结果写入 step.logs，便于前端弹窗展示
            log_text = self._build_indicator_log(
                source="JSON 输入数据",
                indicator_count=len(metric_values),
                items=metrics_list,
            )
            WorkflowStepRepo.update_status(self.task_id, 1, "running", logs=log_text)

            return {
                "message": "指标提取完成（基于JSON输入数据）",
                "indicator_count": len(metric_values),
                "task_id": self.task_id,
            }

        # 没有JSON数据，尝试从PDF提取
        file_path = self.task.get("file_path")
        report_year = self.task.get("report_year")

        if not file_path:
            logger.warning("无PDF文件且无JSON数据，指标提取跳过")
            log_text = "[SKIP] 无PDF文件且无JSON数据，指标提取跳过。"
            WorkflowStepRepo.update_status(self.task_id, 1, "running", logs=log_text)
            return {
                "message": "指标提取跳过（无PDF文件且无JSON数据）",
                "indicator_count": 0,
                "task_id": self.task_id,
            }

        # 如果Step 0没有解析，先解析
        if not self.parsed_data:
            logger.info("Step 0未解析PDF，Step 1先进行解析")
            self.parsed_data = await self.pdf_parser.parse(file_path, report_year)

        # 调用指标提取器
        extracted = await self.indicator_extractor.extract(
            self.task_id, self.parsed_data, file_path, report_year,
            on_phase_start=lambda p, name, total: set_phase(self.task_id, p, name, total, step_index=1),
            on_item_complete=lambda: mark_done(self.task_id),
        )

        # 写入 indicator_values 表
        count = self._insert_extracted_indicators(self.task_id, extracted)

        # 将提取的 JSON 结果 + 诊断信息写入 step.logs，便于前端弹窗展示
        formatted_items = self.indicator_extractor.format_output(extracted)
        diagnostics = getattr(self.indicator_extractor, "last_diagnostics", {}) or {}
        log_text = self._build_indicator_log(
            source="从 PDF 提取",
            indicator_count=count,
            items=formatted_items,
            file_path=file_path,
            diagnostics=diagnostics,
        )
        WorkflowStepRepo.update_status(self.task_id, 1, "running", logs=log_text)

        return {
            "message": f"指标提取完成（从PDF提取{count}项指标）",
            "indicator_count": count,
            "task_id": self.task_id,
        }

    @staticmethod
    def _build_indicator_log(
        source: str,
        indicator_count: int,
        items: list,
        file_path: str = "",
        diagnostics: dict = None,
    ) -> str:
        """
        构造指标提取步骤的日志文本，包含汇总信息、诊断信息和提取后的 JSON 结果。
        在前端的"执行日志"弹窗中以 <pre> 等宽字体展示。
        """
        lines = [
            f"➤ [SOURCE] 数据来源：{source}",
            f"➤ [COUNT] 共提取 {indicator_count} 项指标",
        ]
        if file_path:
            lines.append(f"➤ [FILE] PDF 文件：{file_path}（已成功上传到服务器）")

        # 诊断信息：让用户能定位"为什么 0 项"
        if diagnostics:
            total_pages = diagnostics.get("total_pages", 0)
            located = diagnostics.get("located_chapters") or []
            missing = diagnostics.get("missing_chapters") or []
            report_year = diagnostics.get("report_year")
            lines.append(
                f"➤ [PARSE] PDF 解析：共 {total_pages} 页，报告年份={report_year}"
            )
            lines.append(f"➤ [CHAPTER_OK] 已定位章节（{len(located)}）：{located}")
            if missing:
                lines.append(f"➤ [CHAPTER_MISS] 未定位章节（{len(missing)}）：{missing}")

            cats = diagnostics.get("categories") or []
            if cats:
                lines.append("➤ [CATEGORY] 各分类抽取情况：")
                for c in cats:
                    lines.append(
                        f"    - cat={c.get('cat_id')} ({c.get('label','')}): "
                        f"{c.get('status')} -- {c.get('detail','')}"
                    )

            errors = diagnostics.get("errors") or []
            if errors:
                lines.append("➤ [ERROR] 抽取过程异常：")
                for e in errors:
                    lines.append(f"    - {e}")

        # 0 项时给出友好提示
        if indicator_count == 0:
            lines.append("")
            lines.append(
                "💡 [HINT] 没有提取到指标。常见原因：\n"
                "    1) PDF 章节定位失败：标准年报通常包含「主要会计数据」「分产品/行业」「分地区」「主要控股参股公司」等章节，"
                "若 PDF 是扫描件、加密件或非标准排版，可能无法识别；\n"
                "    2) LLM 调用全部失败：检查后端日志中的 'LLM extraction failed' 错误；\n"
                "    3) 报告年份未识别：确认 PDF 首页含 'YYYY年年度报告' 字样，或在创建任务时手动指定 report_year。\n"
                "    PDF 文件本身已上传成功（文件路径见上面 [FILE] 行）。"
            )

        lines.append("➤ [RESULT] 提取结果（JSON）：")
        try:
            json_text = json.dumps(items or [], ensure_ascii=False, indent=2)
        except (TypeError, ValueError) as e:
            json_text = f"[ERROR] 无法序列化提取结果: {e}"
        return "\n".join(lines) + "\n" + json_text

    @staticmethod
    def _sanitize_metric_value(raw_val: str) -> str:
        """
        清洗指标值：
        - 去除单位后缀（元、%、万元 等）
        - 去除千分位逗号
        - 如果数值为 0（如 0.00元、0.00%、0元、0%），则返回空字符串
        - 原始值为空/None 也返回空字符串
        """
        if not raw_val or not raw_val.strip():
            return ""

        val = raw_val.strip()

        # 去除单位后缀
        import re
        cleaned = re.sub(r'[元%万亿份股]', '', val)
        cleaned = cleaned.replace(',', '').strip()

        # 尝试解析为数字，检测是否为零值
        try:
            num = float(cleaned)
            if num == 0.0:
                return ""
        except (ValueError, TypeError):
            pass

        # 返回原始值（保留完整格式，含单位和逗号）
        return val

    def _insert_metrics_from_json(self, task_id: str, metrics_list: list) -> list:
        """
        将 JSON 指标数据写入 indicator_values 表。
        JSON 格式: [{"name": "...", "key": "...", "val": "..."}, ...]
        """
        metric_values = []
        with get_db() as conn:
            for item in metrics_list:
                indicator_code = item.get("key", "")
                indicator_name = item.get("name", "")
                raw_val = item.get("val", "")

                # 清洗值：零值转为空字符串
                sanitized_val = self._sanitize_metric_value(raw_val)

                conn.execute(
                    """INSERT INTO indicator_values
                       (task_id, indicator_code, indicator_name, category, value, raw_value)
                       VALUES (?, ?, ?, 'financial', ?, ?)""",
                    (task_id, indicator_code, indicator_name, sanitized_val, raw_val)
                )
                metric_values.append({
                    "indicator_code": indicator_code,
                    "indicator_name": indicator_name,
                    "value": sanitized_val,
                    "raw_value": raw_val,
                })

        logger.info("从JSON写入 %d 条指标到 indicator_values", len(metric_values))
        return metric_values

    def _insert_extracted_indicators(self, task_id: str, extracted: list) -> int:
        """将LLM从PDF提取的指标写入 indicator_values 表."""
        if not extracted:
            return 0
        with get_db() as conn:
            for item in extracted:
                conn.execute(
                    """INSERT INTO indicator_values
                       (task_id, indicator_code, indicator_name, category, value, period, raw_value, source_page)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        task_id,
                        item.get("indicator_code", ""),
                        item.get("indicator_name", ""),
                        item.get("category", "financial"),
                        item.get("value", ""),
                        item.get("period"),
                        item.get("raw_value"),
                        item.get("source_page"),
                    ),
                )
        logger.info("从PDF提取并写入 %d 条指标到 indicator_values", len(extracted))
        return len(extracted)

    # def _copy_benchmark_metrics_to_task(self, new_task_id: str) -> list:
    #     """
    #     [已废弃] 从基准任务（task_id=1）复制指标值到新任务
    #     现已改为从 JSON 输入直接写入 indicator_values
    #     """
    #     metric_values = []
    #     with get_db() as conn:
    #         rows = conn.execute(
    #             "SELECT metric_code, metric_name, value FROM rdu_metric_values WHERE task_id = '1'"
    #         ).fetchall()
    #
    #         for row in rows:
    #             conn.execute(
    #                 """INSERT INTO indicator_values
    #                    (task_id, indicator_code, indicator_name, category, value)
    #                    VALUES (?, ?, ?, 'financial', ?)""",
    #                 (new_task_id, row["metric_code"], row["metric_name"], row["value"])
    #             )
    #             metric_values.append({
    #                 "indicator_code": row["metric_code"],
    #                 "indicator_name": row["metric_name"],
    #                 "value": row["value"],
    #             })
    #
    #     return metric_values

    async def _step_2_analyze_risk_signals(self) -> dict:
        """
        Step 2: RDU风险信号分析（自动节点）
        两阶段LLM调用：
          Phase 1: metrics-cot (risk_judgment) — 输出风险判断逻辑
          Phase 2: cot-risk   (risk_signal)   — 输出风险信号名称
        分析完成后自动进入 Step 3 等待专家确认。
        """
        # 1. 获取当前任务的所有指标值
        indicators = IndicatorValueRepo.get_by_task(self.task_id)
        indicator_map = {ind["indicator_code"]: ind for ind in indicators}

        # 2. 读取所有RDU风险信号定义
        all_rdu_signals = RDURiskSignalsRepo.list_all()

        # 3. 在内存中组装RDU风险判断体
        risk_judgment_objects = []
        for rdu_signal in all_rdu_signals:
            metric_codes = rdu_signal["metric_codes"]

            matched_indicators = []
            for code in metric_codes:
                if code in indicator_map:
                    ind = indicator_map[code]
                    matched_indicators.append({
                        "indicator_code": ind["indicator_code"],
                        "indicator_name": ind["indicator_name"],
                        "value": ind["value"],
                    })

            judgment_obj = {
                "rdu_id": rdu_signal["id"],
                "rdu_name": rdu_signal["risk_signal"],
                "category_id": rdu_signal["category_id"],
                "indicators": matched_indicators,
                "is_triggered": False,
                "similarity_score": None,
                "logic": "",
                "logic_raw": "",
                "risk": "",
            }
            risk_judgment_objects.append(judgment_obj)

        # 4. Phase 1: metrics-cot (risk_judgment) — 批量并发获取风险判断逻辑
        #    仅对匹配指标 >= 2 的风险信号调用 LLM，不足 2 个说明指标不全，跳过
        judgment_model = self.get_model_for_purpose("risk_judgment")
        if judgment_model:
            eligible_indices = [
                i for i, j in enumerate(risk_judgment_objects)
                if len(j.get("indicators", [])) >= 2
            ]
            skipped_count = len(risk_judgment_objects) - len(eligible_indices)
            if skipped_count:
                logger.info(
                    "Phase 1: %d/%d signals skipped (indicators < 2)",
                    skipped_count, len(risk_judgment_objects),
                )
                for i, j in enumerate(risk_judgment_objects):
                    if i not in set(eligible_indices):
                        j["similarity_score"] = 0.0

            if eligible_indices:
                prompts = [
                    (self._build_risk_judgment_prompt(risk_judgment_objects[i]), None)
                    for i in eligible_indices
                ]
                set_phase(self.task_id, 1, "RDU风险判断逻辑分析", len(prompts), step_index=2)
                raw_results = await self.llm_service.chat_batch_raw(
                    prompts, purpose="risk_judgment",
                    on_item_complete=lambda idx: mark_done(self.task_id),
                )
                for idx, raw in zip(eligible_indices, raw_results):
                    if raw is None:
                        continue
                    risk_judgment_objects[idx]["logic_raw"] = raw
                    risk_judgment_objects[idx]["logic"] = parse_llm_content(raw)
            else:
                logger.warning("Phase 1: all signals skipped, no LLM calls needed")
        else:
            logger.warning("No risk_judgment model configured, skipping Phase 1")

        # 5. Phase 2: cot-risk (risk_signal) — 批量并发获取风险信号名称
        signal_model = self.get_model_for_purpose("risk_signal")
        if signal_model:
            valid_indices = [
                i for i, j in enumerate(risk_judgment_objects) if j.get("logic_raw")
            ]
            if valid_indices:
                signal_prompts = [
                    (self._build_risk_signal_prompt(risk_judgment_objects[i]), None)
                    for i in valid_indices
                ]
                set_phase(self.task_id, 2, "RDU风险信号提取", len(signal_prompts), step_index=2)
                signal_raw_results = await self.llm_service.chat_batch_raw(
                    signal_prompts, purpose="risk_signal",
                    on_item_complete=lambda idx: mark_done(self.task_id),
                )
                for idx, raw in zip(valid_indices, signal_raw_results):
                    if raw is None:
                        continue
                    signal_text = parse_llm_content(raw, strict=True)
                    risk_judgment_objects[idx]["risk"] = signal_text

                # Phase 2.5: BERTScore 相似度评分 — name vs risk
                scored_indices = [i for i in valid_indices if risk_judgment_objects[i].get("risk")]
                predictions = [risk_judgment_objects[i]["risk"] for i in scored_indices]
                references = [risk_judgment_objects[i]["rdu_name"] for i in scored_indices]
                scores = await compute_bert_f1_scores(predictions, references)
                for idx, score in zip(scored_indices, scores):
                    risk_judgment_objects[idx]["similarity_score"] = round(score, 2)
                    risk_judgment_objects[idx]["is_triggered"] = score >= 99.5
                    logger.info(
                        "BERTScore: name=%s | risk=%s | score=%.2f | triggered=%s",
                        risk_judgment_objects[idx]["rdu_name"],
                        risk_judgment_objects[idx]["risk"],
                        score,
                        risk_judgment_objects[idx]["is_triggered"],
                    )
        else:
            logger.warning("No risk_signal model configured, skipping Phase 2")

        # 6. 保存风险信号实例到 risk_signals 表
        signal_instances = []
        with get_db() as conn:
            for judgment_obj in risk_judgment_objects:
                signal_id = f"signal_{judgment_obj['rdu_id']}_{self.task_id}"
                indicators_json = json.dumps(judgment_obj["indicators"], ensure_ascii=False)
                risk_text = judgment_obj["risk"] or f"需要问询：{judgment_obj['rdu_name']}"

                conn.execute(
                    """INSERT OR REPLACE INTO risk_signals
                       (id, task_id, signal_code, name, category_id, indicators, logic, risk,
                        inquiry_logic, inquiry_item, is_triggered, similarity_score, status)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 'pending_review')""",
                    (
                        signal_id,
                        self.task_id,
                        str(judgment_obj["rdu_id"]),
                        judgment_obj["rdu_name"],
                        judgment_obj["category_id"],
                        indicators_json,
                        judgment_obj["logic"],
                        risk_text,
                        1 if judgment_obj["is_triggered"] else 0,
                        judgment_obj.get("similarity_score"),
                    )
                )

                signal_instances.append({
                    "id": signal_id,
                    "signal_code": str(judgment_obj["rdu_id"]),
                    "name": judgment_obj["rdu_name"],
                    "category_id": judgment_obj["category_id"],
                    "indicators": judgment_obj["indicators"],
                    "logic": judgment_obj["logic"],
                    "risk": risk_text,
                    "is_triggered": judgment_obj["is_triggered"],
                    "similarity_score": judgment_obj.get("similarity_score"),
                    "status": "pending_review",
                })

        return {
            "message": "风险信号分析完成",
            "signal_count": len(signal_instances),
            "signals": signal_instances,
            "task_id": self.task_id,
        }

    def _build_risk_judgment_prompt(self, judgment_obj: dict) -> str:
        """
        Phase 1 prompt builder: 构建 metrics-cot 风险判断逻辑的 user prompt.
        只传入指标名:指标值，不附加额外提示文本。
        """
        indicator_lines = []
        for ind in judgment_obj["indicators"]:
            indicator_lines.append(f"{ind['indicator_name']}: {ind['value']}")
        return "\n".join(indicator_lines) if indicator_lines else "（无匹配指标数据）"

    def _build_risk_signal_prompt(self, judgment_obj: dict) -> str:
        """
        Phase 2 prompt builder: 将 Phase 1 的完整输出作为 cot-risk 的输入.
        """
        return judgment_obj.get("logic_raw", "")

    async def _step_3_confirm_risk_signals(self) -> dict:
        """
        Step 3: RDU风险信号触发判断（人工审核节点）
        数据已在 Step 2 准备好，等待专家确认触发状态。
        """
        signals = RiskSignalInstanceRepo.get_by_task(self.task_id)
        triggered = [s for s in signals if s["is_triggered"]]

        return {
            "message": "风险信号已准备好，等待专家确认",
            "signal_count": len(triggered),
            "total_count": len(signals),
            "signals": signals,
            "task_id": self.task_id,
        }

    async def _step_4_generate_inquiry_items(self) -> dict:
        """
        Step 4: 问询事项生成（自动节点）
        两阶段LLM调用：
          Phase 1: risk-cot  (inquiry_logic) — 输出问询逻辑
          Phase 2: cot-inquiry (inquiry_item) — 输出问询事项
        仅处理经专家确认触发的风险信号。
        """
        signals = RiskSignalInstanceRepo.get_by_task(self.task_id)
        triggered = [s for s in signals if s["is_triggered"]]

        if not triggered:
            return {
                "message": "无触发信号，跳过问询事项生成",
                "processed_count": 0,
                "task_id": self.task_id,
            }

        # ---- 构建 signal_id -> theme_name 映射 ----
        all_categories = RDUCategoryRepo.list_all()
        cat_map = {c["id"]: c for c in all_categories}
        theme_map = {}  # signal["id"] -> theme name (level=0 parent)
        for s in triggered:
            cat_id = s.get("category_id")
            theme_name = "未知主题"
            if cat_id and cat_id in cat_map:
                cat = cat_map[cat_id]
                if cat["level"] == 0:
                    theme_name = cat["name"]
                elif cat.get("parent_id") and cat["parent_id"] in cat_map:
                    theme_name = cat_map[cat["parent_id"]]["name"]
            theme_map[s["id"]] = theme_name
            logger.info(
                "Step4 theme lookup: signal=%s | category_id=%s | theme=%s",
                s["name"], cat_id, theme_name,
            )

        # Phase 1: risk-cot (inquiry_logic) — 批量并发生成问询逻辑
        inquiry_logic_model = self.get_model_for_purpose("inquiry_logic")
        logic_raw_map = {}  # signal_id -> raw output
        if inquiry_logic_model:
            prompts = [
                (self._build_inquiry_logic_prompt(s, theme_map[s["id"]]), None)
                for s in triggered
            ]
            for s, p in zip(triggered, prompts):
                logger.info(
                    "Step4 Phase1 INPUT: signal=%s | prompt=\n%s",
                    s["name"], p[0],
                )
            set_phase(self.task_id, 1, "问询逻辑生成", len(prompts), step_index=4)
            raw_results = await self.llm_service.chat_batch_raw(
                prompts, purpose="inquiry_logic",
                on_item_complete=lambda idx: mark_done(self.task_id),
            )
            for signal, raw in zip(triggered, raw_results):
                if raw is None:
                    logger.warning("Step4 Phase1 FAILED: signal=%s", signal["name"])
                    continue
                logic_raw_map[signal["id"]] = raw
                parsed = parse_llm_content(raw)
                RiskSignalInstanceRepo.update(signal["id"], inquiry_logic=parsed)
                logger.info(
                    "Step4 Phase1 OUTPUT: signal=%s | raw(first200)=%s",
                    signal["name"], strip_think_blocks(raw)[:200],
                )
                logger.info(
                    "Step4 Phase1 PARSED: signal=%s | parsed(first200)=%s",
                    signal["name"], parsed[:200],
                )
        else:
            logger.warning("No inquiry_logic model configured, skipping Phase 1")

        # Phase 2: cot-inquiry (inquiry_item) — 批量并发生成问询事项
        inquiry_item_model = self.get_model_for_purpose("inquiry_item")
        if inquiry_item_model:
            valid_signals = [s for s in triggered if logic_raw_map.get(s["id"])]
            if valid_signals:
                prompts = [
                    (f"【主题】{theme_map[s['id']]}\n{logic_raw_map[s['id']]}", None)
                    for s in valid_signals
                ]
                for s, p in zip(valid_signals, prompts):
                    logger.info(
                        "Step4 Phase2 INPUT: signal=%s | prompt(first300)=\n%s",
                        s["name"], strip_think_blocks(p[0])[:300],
                    )
                set_phase(self.task_id, 2, "问询事项生成", len(prompts), step_index=4)
                raw_results = await self.llm_service.chat_batch_raw(
                    prompts, purpose="inquiry_item",
                    on_item_complete=lambda idx: mark_done(self.task_id),
                )
                for signal, raw in zip(valid_signals, raw_results):
                    if raw is None:
                        logger.warning("Step4 Phase2 FAILED: signal=%s", signal["name"])
                        continue
                    # 只保留【问询内容】标记后的内容；找不到则保留全文
                    content = strip_think_blocks(raw)
                    logger.info(
                        "Step4 Phase2 RAW OUTPUT: signal=%s | content(first300)=%s",
                        signal["name"], content[:300],
                    )
                    match = re.search(r'【问询内容】[：:]*\s*(.*)', content, re.DOTALL)
                    if match:
                        parsed = match.group(1).strip()
                    else:
                        parsed = parse_llm_content(raw)
                    RiskSignalInstanceRepo.update(signal["id"], inquiry_item=parsed)
                    logger.info(
                        "Step4 Phase2 PARSED: signal=%s | parsed(first300)=%s",
                        signal["name"], parsed[:300],
                    )
        else:
            logger.warning("No inquiry_item model configured, skipping Phase 2")

        # 重新读取更新后的数据
        updated_signals = RiskSignalInstanceRepo.get_by_task(self.task_id)
        updated_triggered = [s for s in updated_signals if s["is_triggered"]]

        return {
            "message": "问询事项生成完成",
            "processed_count": len(updated_triggered),
            "signals": updated_triggered,
            "task_id": self.task_id,
        }

    def _build_inquiry_logic_prompt(self, signal: dict, theme_name: str) -> str:
        """
        Phase 1 prompt builder: 【主题】+ 【风险信号】（来自 Step 2 Phase 2 输出的 risk 字段）。
        """
        risk = signal.get("risk", "") or signal.get("name", "")
        return f"【主题】{theme_name}\n【风险信号】{risk}。"

    async def _step_5_confirm_inquiry_items(self) -> dict:
        """
        Step 5: 问询事项确认（人工审核节点）
        - 数据已在Step 4准备好
        - 等待用户确认/修改问询事项
        """
        signals = RiskSignalInstanceRepo.get_by_task(self.task_id)
        triggered = [s for s in signals if s["is_triggered"]]

        return {
            "message": "问询事项已准备好，等待用户确认",
            "item_count": len(triggered),
            "signals": triggered,
            "task_id": self.task_id,
        }

    async def _step_6_draft_inquiry_letter(self) -> dict:
        """
        Step 6: 起草正式问询函
        按主题分组已触发信号，构建结构化输入，调用通用LLM组装问询函正文。
        """
        signals = RiskSignalInstanceRepo.get_by_task(self.task_id)
        confirmed = [s for s in signals if s["is_triggered"] and s.get("inquiry_item")]

        if not confirmed:
            return {
                "message": "无已确认的问询事项，跳过问询函生成",
                "item_count": 0,
                "task_id": self.task_id,
            }

        company_name = self.task.get("company_name", "未知公司")
        report_year = self.task.get("report_year", "未知年份")

        # 按主题分组
        themes = self._group_signals_by_theme(confirmed)

        # 构建结构化 prompt
        prompt = self._build_inquiry_letter_prompt(company_name, report_year, themes)
        logger.info("Step6 inquiry_letter prompt length=%d, themes=%d", len(prompt), len(themes))

        # 调用通用LLM生成问询函（流式输出）
        letter_content = await self.llm_service.chat_stream(
            prompt=prompt,
            purpose="common",
            on_chunk=lambda text: set_streaming_text(
                self.task_id, strip_think_blocks(text)
            ),
        )

        # 保存问询函
        from app.models.task import InquiryLetterRepo
        InquiryLetterRepo.create(task_id=self.task_id, content=letter_content)

        logger.info(
            "Step6 inquiry_letter: company=%s year=%s items=%d content_len=%d",
            company_name, report_year, len(confirmed), len(letter_content),
        )

        return {
            "message": "问询函草稿生成完成",
            "item_count": len(confirmed),
            "letter_content": letter_content,
            "task_id": self.task_id,
        }

    def _group_signals_by_theme(self, confirmed: list[dict]) -> list[dict]:
        """
        将已确认触发的信号按主题 (level=0 分类) 分组。
        返回: [{"theme": "经营业绩", "indicators": [...], "inquiry_items": [...]}, ...]
        """
        all_categories = RDUCategoryRepo.list_all()
        cat_map = {c["id"]: c for c in all_categories}

        def get_theme_name(category_id):
            """从 level=1 category_id 找到 level=0 主题名称。"""
            cat = cat_map.get(category_id)
            if not cat:
                return "其他"
            if cat.get("level") == 0:
                name = cat["name"]
                return name.replace("关于", "") if name.startswith("关于") else name
            parent = cat_map.get(cat.get("parent_id"))
            if parent:
                name = parent["name"]
                return name.replace("关于", "") if name.startswith("关于") else name
            return "其他"

        # 按主题分组，指标按 indicator_code 去重
        theme_groups = {}
        theme_order = []

        for signal in confirmed:
            category_id = signal.get("category_id")
            theme_name = get_theme_name(category_id) if category_id else "其他"

            if theme_name not in theme_groups:
                theme_groups[theme_name] = {
                    "indicators_seen": set(),
                    "indicators": [],
                    "inquiry_items": [],
                }
                theme_order.append(theme_name)
            group = theme_groups[theme_name]

            # 解析并去重指标
            indicators = signal.get("indicators", "")
            if isinstance(indicators, str):
                try:
                    indicators = json.loads(indicators)
                except (json.JSONDecodeError, TypeError):
                    indicators = []
            for ind in indicators:
                code = ind.get("indicator_code", "")
                if code not in group["indicators_seen"]:
                    group["indicators_seen"].add(code)
                    group["indicators"].append(ind)

            # 收集问询事项
            inquiry_item = signal.get("inquiry_item", "")
            if inquiry_item:
                group["inquiry_items"].append(inquiry_item)

        return [
            {
                "theme": name,
                "indicators": theme_groups[name]["indicators"],
                "inquiry_items": theme_groups[name]["inquiry_items"],
            }
            for name in theme_order
        ]

    def _build_inquiry_letter_prompt(
        self, company_name: str, report_year, themes: list[dict]
    ) -> str:
        """
        构建起草问询函的 user prompt：按主题结构化输入。
        """
        lines = [
            f"公司名称：{company_name}",
            f"报告期间：{report_year}年年度报告",
            "",
        ]

        for i, theme in enumerate(themes, 1):
            lines.append(f"===== 主题 {i}：{theme['theme']} =====")
            lines.append("")

            # 指标数据
            lines.append("相关指标数据（所有数值必须原样保留，不得修改或删除）：")
            for ind in theme["indicators"]:
                lines.append(f"  {ind.get('indicator_name', '')}: {ind.get('value', '')}")
            lines.append("")

            # 问询事项
            lines.append("问询事项（必须原封不动逐条输出，不得修改内容）：")
            for j, item in enumerate(theme["inquiry_items"], 1):
                lines.append(f"  [{j}] {item}")
            lines.append("")

        return "\n".join(lines)

    def _get_step_defs(self):
        """Get workflow step definitions."""
        from app.routers.workflow import WORKFLOW_STEPS
        return WORKFLOW_STEPS
