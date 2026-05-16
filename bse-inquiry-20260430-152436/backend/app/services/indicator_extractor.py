"""
Indicator extractor service - extracts financial indicators from parsed annual report data
using LLM (Large Language Model) calls in batches by category.

Pipeline:
1. Load metric definitions from rdu_metrics_standard, grouped by category_id
2. Build extraction prompts for each category using chapter content
3. Call LLM in parallel batches (one per category)
4. Parse LLM JSON responses
5. Map extracted items to standard metric codes (3-layer matching)
6. Optionally run supplementary extraction for low-coverage results
7. Return final [{name, key, val}] list
"""

import asyncio
import json
import logging
import re
from typing import Optional

# 指标提取专用：关闭 Qwen3 think 模式，避免 CoT 消耗 token 预算
_NO_THINK = {"chat_template_kwargs": {"enable_thinking": False}}

from app.database import get_db
from app.services.llm_service import LLMService, strip_think_blocks
from app.prompts.indicator_extract import (
    build_extraction_prompt,
    CATEGORY_LABELS,
    CATEGORY_CHAPTER_MAP,
)

logger = logging.getLogger(__name__)

# Categories to extract (in order)
# 与 DB rdu_categories 的 id 对齐：2=整体业绩, 3=现金流/净利润差异, 4=分季度/期后,
# 5=分业务（产品）, 6=分区域/境内外, 7=分子公司
EXTRACT_CATEGORIES = [2, 3, 4, 5, 6, 7]

# Minimum coverage ratio before triggering supplementary extraction
MIN_COVERAGE_RATIO = 0.8


class IndicatorExtractorService:
    """
    Service for extracting financial indicators from parsed annual report data.

    Uses LLM to interpret financial tables and text, mapping extracted values
    to 112 standard RDU metric codes.
    """

    def __init__(self):
        self.llm_service = LLMService()
        # 上次 extract() 的诊断信息，供上层（workflow_engine）写入 step.logs
        self.last_diagnostics: dict = {}

    async def extract(
        self,
        task_id: str,
        parsed_data: dict,
        file_path: str,
        report_year: int = None,
        on_phase_start: Optional[callable] = None,
        on_item_complete: Optional[callable] = None,
    ) -> list[dict]:
        """
        Extract financial indicators from parsed PDF data.

        Args:
            task_id: The task ID
            parsed_data: Output from PDFParserService.parse()
            file_path: Path to the PDF file (for supplementary extraction)
            report_year: The report year
            on_phase_start: callback(phase, phase_name, total) called at start of each phase
            on_item_complete: callback() called after each LLM call completes

        Returns:
            List of indicator dicts with keys:
            - indicator_code: The standard metric code
            - indicator_name: The standard metric name
            - category: Category label
            - value: The extracted value string
            - raw_value: Optional real name mapping or raw LLM output
            - source_page: Optional page number

        Side effect:
            将本次抽取过程的诊断信息写入 self.last_diagnostics（供上层把详细原因写到 step.logs 中）
        """
        # 重置诊断信息
        self.last_diagnostics = {
            "report_year": report_year,
            "report_year_detected": parsed_data.get("metadata", {}).get("report_year_detected"),
            "total_pages": parsed_data.get("metadata", {}).get("total_pages", 0),
            "located_chapters": list((parsed_data.get("chapter_locations") or {}).keys()),
            "missing_chapters": list(parsed_data.get("missing_chapters", []) or []),
            "categories": [],   # [{cat_id, label, status, detail}]
            "errors": [],
        }

        if not report_year:
            report_year = parsed_data.get("metadata", {}).get("report_year_detected")
        if not report_year:
            err_msg = f"无法确定报告年份（PDF metadata 中也未识别到）"
            logger.error("Cannot determine report year for task %s", task_id)
            self.last_diagnostics["errors"].append(err_msg)
            return []
        self.last_diagnostics["report_year"] = report_year

        chapters = parsed_data.get("chapters", {})
        missing_chapters = set(parsed_data.get("missing_chapters", []))

        # Load all metric definitions grouped by category
        all_metrics = self._load_all_metrics()

        # Build prompts and call LLM for each category in parallel
        extraction_tasks = []
        category_metrics_map = {}
        filtered_all_metrics = {}  # Keep track of filtered metrics per category
        for cat_id in EXTRACT_CATEGORIES:
            label = CATEGORY_LABELS.get(cat_id, str(cat_id))
            metrics = all_metrics.get(cat_id, [])
            if not metrics:
                self.last_diagnostics["categories"].append({
                    "cat_id": cat_id, "label": label,
                    "status": "skipped", "detail": "标准指标库中无该 category 的指标定义",
                })
                continue

            # Check if required chapters are available
            required_chapters = CATEGORY_CHAPTER_MAP.get(cat_id, [])
            available = [c for c in required_chapters if c not in missing_chapters and c in chapters]
            if not available:
                logger.warning(
                    "Category %d (%s): no chapters available, skipping",
                    cat_id, label,
                )
                self.last_diagnostics["categories"].append({
                    "cat_id": cat_id, "label": label,
                    "status": "skipped",
                    "detail": f"PDF 中未定位到所需章节 {required_chapters}",
                })
                continue

            # Filter out unreliable metrics to prevent LLM hallucination
            filtered_metrics = self._filter_unreliable_metrics(metrics, cat_id, chapters)
            if not filtered_metrics:
                self.last_diagnostics["categories"].append({
                    "cat_id": cat_id, "label": label,
                    "status": "skipped",
                    "detail": "可靠性过滤后无可用指标",
                })
                continue

            filtered_all_metrics[cat_id] = filtered_metrics
            category_metrics_map[cat_id] = filtered_metrics
            system_prompt, user_prompt = build_extraction_prompt(
                cat_id, filtered_metrics, chapters, report_year
            )
            extraction_tasks.append(
                self._call_llm_extract(cat_id, system_prompt, user_prompt)
            )

        # Execute all LLM calls concurrently
        if not extraction_tasks:
            logger.warning("No extraction tasks to run for task %s", task_id)
            self.last_diagnostics["errors"].append(
                "所有 category 都被跳过，未发起任何 LLM 调用（最常见原因：PDF 章节定位失败）"
            )
            return []

        # Phase 1: parallel category extraction
        if on_phase_start:
            on_phase_start(1, "分类指标提取", len(extraction_tasks))

        # Wrap each task to fire on_item_complete callback
        async def _tracked(coro):
            result = await coro
            if on_item_complete:
                on_item_complete()
            return result

        raw_results = await asyncio.gather(
            *[_tracked(t) for t in extraction_tasks], return_exceptions=True
        )

        # Process results
        all_indicators = []
        extracted_codes = set()

        for (cat_id, metrics), result in zip(category_metrics_map.items(), raw_results):
            label = CATEGORY_LABELS.get(cat_id, str(cat_id))
            if isinstance(result, Exception):
                logger.error(
                    "LLM extraction failed for category %d: %s", cat_id, result
                )
                self.last_diagnostics["categories"].append({
                    "cat_id": cat_id, "label": label,
                    "status": "llm_error",
                    "detail": f"{type(result).__name__}: {str(result)[:200]}",
                })
                continue

            cat_id_actual, raw_response = result
            items = self._parse_llm_response(raw_response)
            logger.info(
                "Category %d: LLM returned %d items", cat_id, len(items)
            )

            # Map to standard codes
            mapped = self._map_to_standard_codes(items, metrics)
            for item in mapped:
                item["category"] = CATEGORY_LABELS.get(cat_id, str(cat_id))
                all_indicators.append(item)
                extracted_codes.add(item["indicator_code"])

            self.last_diagnostics["categories"].append({
                "cat_id": cat_id, "label": label,
                "status": "ok",
                "detail": f"LLM 返回 {len(items)} 项，映射到 {len(mapped)} 个标准指标",
            })

        # Check coverage against filtered metrics only
        total_filtered_metrics = sum(len(m) for m in filtered_all_metrics.values())
        coverage = len(extracted_codes) / total_filtered_metrics if total_filtered_metrics > 0 else 0
        logger.info(
            "Extraction coverage: %d/%d (%.1f%%)",
            len(extracted_codes), total_filtered_metrics, coverage * 100,
        )

        # Supplementary extraction if coverage is too low
        # Only consider metrics that passed the reliability filter
        if coverage < MIN_COVERAGE_RATIO and file_path:
            missing_codes = []
            for cat_id, metrics in filtered_all_metrics.items():
                for m in metrics:
                    if m["metric_code"] not in extracted_codes:
                        missing_codes.append(m)

            if missing_codes:
                logger.info(
                    "Triggering supplementary extraction for %d missing indicators",
                    len(missing_codes),
                )
                # Phase 2: supplementary extraction (single LLM call)
                if on_phase_start:
                    on_phase_start(2, "补充提取", 1)
                supplementary = await self._run_supplementary_extraction(
                    missing_codes, file_path, report_year, chapters
                )
                if on_item_complete:
                    on_item_complete()
                for item in supplementary:
                    if item["indicator_code"] not in extracted_codes:
                        all_indicators.append(item)
                        extracted_codes.add(item["indicator_code"])

        logger.info(
            "Final extraction: %d indicators for task %s", len(all_indicators), task_id
        )
        return all_indicators

    def _load_all_metrics(self) -> dict[int, list[dict]]:
        """
        Load all metric definitions from rdu_metrics_standard, grouped by category_id.

        Returns:
            Dict of category_id -> [{"metric_name", "metric_code", "category_id"}, ...]
        """
        grouped = {}
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, category_id, metric_name, metric_code "
                "FROM rdu_metrics_standard ORDER BY id"
            ).fetchall()
            for row in rows:
                cat_id = row["category_id"]
                if cat_id not in grouped:
                    grouped[cat_id] = []
                grouped[cat_id].append({
                    "id": row["id"],
                    "category_id": cat_id,
                    "metric_name": row["metric_name"],
                    "metric_code": row["metric_code"],
                })
        return grouped

    def _filter_unreliable_metrics(
        self, metrics: list[dict], cat_id: int, chapters: dict
    ) -> list[dict]:
        """
        Filter out metrics that annual reports objectively NEVER disclose.

        设计原则（防幻觉 vs 提取量平衡）：
        - 防幻觉的主要责任交给 prompt（已规定"严禁编造，找不到就跳过"）。
        - 过滤层只剔除"年报客观上 100% 不会披露"的字段，避免占用 token 与
          诱导 LLM 编造。
        - 原则上**保留所有 T 期指标**和绝大多数 T-1 期对比项（年报正文
          普遍提供同比数据），最大化召回。

        新 cat_id（与 DB rdu_categories 对齐）：
          2 = 整体业绩         (REV/GPM/NP × T/T-1/T-2)         9 项 → 全保留
          3 = 现金流/净利润差异  (OCF_NET × T/T-1/T-2)            3 项 → 全保留
          4 = 分季度/期后       (REV/NP × Q1-Q4 + GPM Q1 + T+1)  12 项 → 丢 T+1 + 季度 GPM
          5 = 分业务（产品）    (BIZ01-05 × REV/GPM × T/T-1/T-2) 30 项 → 丢 T-2 + T-1 GPM
          6 = 分区域/境内外     (REGION01-05 + DOMESTIC/OVERSEAS) 28 项 → 全保留（让 LLM 自行判断）
          7 = 分子公司          (COMPANY01-05 × REV/GPM/NP × T/T-1) 30 项 → 丢 T-1 GPM
        """
        result = []
        for m in metrics:
            code = m.get("metric_code", "")
            name = m.get("metric_name", "")

            # ---- 全局规则：年报基本不披露 T+1 Q1 数据 ----
            if "TP1" in code or "T+1" in name:
                continue

            # ---- cat=4 分季度：丢季度毛利率（年报极少按季度披露毛利率）----
            if cat_id == 4 and "GPM" in code:
                continue

            # ---- cat=5 分业务：丢 T-2 期业务明细 + T-1 业务毛利率 ----
            #     年报"主营业务分析-分产品"通常只列 T 期+T-1 营收对比，
            #     基本不会给 T-2 业务分项，也很少给 T-1 业务毛利率。
            if cat_id == 5:
                if "T_2" in code:
                    continue
                if "T_1" in code and "GPM" in code:
                    continue

            # ---- cat=7 分子公司：丢 T-1 子公司毛利率（不直接披露）----
            #     "主要控股参股公司"表通常给营收/净利润，毛利率往往只有 T 期。
            if cat_id == 7 and "T_1" in code and "GPM" in code:
                continue

            # 注意：cat=6（分区域）此前会丢 REGION01-05 整组，现在保留。
            #   - 若年报有"按区域分类分析"且列出具体地区 → LLM 能正确映射
            #   - 若只有境内/境外 → prompt 已明确"REGION 系列必须跳过，
            #     不得用境内/境外填充"，由 LLM 自行跳过即可

            result.append(m)
        return result

    async def _call_llm_extract(
        self, category_id: int, system_prompt: str, user_prompt: str
    ) -> tuple[int, str]:
        """
        Call LLM for a single category extraction.
        Uses streaming + no-think mode for faster, more reliable extraction.

        Returns:
            Tuple of (category_id, raw_response_text)
        """
        try:
            raw = await self.llm_service.chat(
                prompt=user_prompt,
                system_prompt=system_prompt,
                purpose="common",
                extra_body=_NO_THINK,
                use_stream=True,
            )
            return (category_id, raw)
        except Exception as e:
            logger.error("LLM call failed for category %d: %s", category_id, e)
            # Retry once
            try:
                logger.info("Retrying LLM call for category %d", category_id)
                raw = await self.llm_service.chat(
                    prompt=user_prompt,
                    system_prompt=system_prompt,
                    purpose="common",
                    extra_body=_NO_THINK,
                    use_stream=True,
                )
                return (category_id, raw)
            except Exception as retry_err:
                logger.error(
                    "LLM retry also failed for category %d: %s",
                    category_id, retry_err,
                )
                raise

    def _parse_llm_response(self, raw_response: str) -> list[dict]:
        """
        Parse LLM response into a list of indicator dicts.
        Handles various response formats including think blocks and markdown fences.

        Returns:
            List of dicts with at least 'name', 'key', 'val' keys.
        """
        if not raw_response:
            return []

        text = strip_think_blocks(raw_response).strip()

        # Try to find JSON array in the response
        # First, try direct JSON parse
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return self._clean_items(data)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code fences
        fence_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if fence_match:
            try:
                data = json.loads(fence_match.group(1))
                if isinstance(data, list):
                    return self._clean_items(data)
            except json.JSONDecodeError:
                pass

        # Try to find JSON array with regex
        array_match = re.search(r'\[.*\]', text, re.DOTALL)
        if array_match:
            try:
                data = json.loads(array_match.group(0))
                if isinstance(data, list):
                    return self._clean_items(data)
            except json.JSONDecodeError:
                pass

        logger.warning("Failed to parse LLM response as JSON array")
        return []

    def _clean_items(self, items: list) -> list[dict]:
        """
        Clean and validate parsed items. Filter out non-dict items
        and the special _name_mapping object.
        """
        result = []
        for item in items:
            if not isinstance(item, dict):
                continue
            # Skip the _name_mapping helper object
            if "_name_mapping" in item:
                continue
            # Must have at least key or name
            if not item.get("key") and not item.get("name"):
                continue
            result.append(item)
        return result

    def _extract_name_mapping(self, items: list) -> dict:
        """Extract the _name_mapping from LLM response items (if present)."""
        for item in items:
            if isinstance(item, dict) and "_name_mapping" in item:
                return item["_name_mapping"]
        return {}

    def _map_to_standard_codes(
        self, extracted_items: list[dict], metrics: list[dict]
    ) -> list[dict]:
        """
        Map LLM-extracted items to standard metric codes using 3-layer matching.

        Layer 1: Direct key match (LLM returned the correct metric_code)
        Layer 2: Exact name match against metric_name
        Layer 3: Fuzzy rule-based inference

        Returns:
            List of validated indicator dicts.
        """
        # Build lookup dicts
        code_set = {m["metric_code"] for m in metrics}
        name_to_code = {m["metric_name"]: m["metric_code"] for m in metrics}
        code_to_name = {m["metric_code"]: m["metric_name"] for m in metrics}

        result = []
        matched_codes = set()

        for item in extracted_items:
            key = str(item.get("key") or "").strip()
            name = str(item.get("name") or "").strip()
            val = str(item.get("val") or "").strip()

            if not val:
                continue

            matched_code = None
            matched_name = None

            # Layer 1: Direct key match
            if key in code_set:
                matched_code = key
                matched_name = code_to_name.get(key, name)

            # Layer 2: Exact name match
            if not matched_code and name in name_to_code:
                matched_code = name_to_code[name]
                matched_name = name

            # Layer 3: Fuzzy rule-based inference
            if not matched_code:
                matched_code = self._fuzzy_match_code(name, key, metrics)
                if matched_code:
                    matched_name = code_to_name.get(matched_code, name)

            if matched_code and matched_code not in matched_codes:
                matched_codes.add(matched_code)
                result.append({
                    "indicator_code": matched_code,
                    "indicator_name": matched_name or name,
                    "value": val,
                    "raw_value": name if name != matched_name else None,
                    "source_page": item.get("page") or item.get("source_page"),
                })

        return result

    def _fuzzy_match_code(
        self, name: str, key: str, metrics: list[dict]
    ) -> Optional[str]:
        """
        Layer 3: Try to infer the metric_code from name/key using heuristic rules.

        Extracts period (T/T-1/T-2), indicator type (REV/GPM/NP/OCF_NET),
        and slot number (BIZ01-05, REGION01-05, COMPANY01-05) to reconstruct
        a candidate metric_code pattern.
        """
        if not name and not key:
            return None

        text = name or key

        # Extract period suffix
        period_suffix = ""
        if "T+1" in text or "T＋1" in text:
            period_suffix = "TP1_Q1"
        elif "T-2" in text or "T－2" in text:
            period_suffix = "T_2"
        elif "T-1" in text or "T－1" in text:
            period_suffix = "T_1"
        elif "T期" in text or "T " in text:
            period_suffix = "T"

        # Extract indicator type
        indicator_type = ""
        if "毛利率" in text:
            indicator_type = "GPM"
        elif "净利润" in text:
            indicator_type = "NP"
        elif "营业收入" in text:
            indicator_type = "REV"
        elif "现金流量净额" in text or "现金流" in text:
            indicator_type = "OCF_NET"

        if not period_suffix or not indicator_type:
            return None

        # Extract quarter
        quarter = ""
        q_match = re.search(r'Q(\d)', text)
        if q_match:
            quarter = f"_Q{q_match.group(1)}"

        # Extract slot (BIZ/REGION/COMPANY)
        slot = ""
        for prefix, patterns in [
            ("BIZ", [r'业务(\d)', r'产品(\d)']),
            ("REGION", [r'区域(\d)']),
            ("COMPANY", [r'公司(\d)', r'子公司(\d)']),
        ]:
            for pat in patterns:
                m = re.search(pat, text)
                if m:
                    slot = f"{prefix}{int(m.group(1)):02d}"
                    break
            if slot:
                break

        # Check for domestic/overseas
        if not slot:
            if "境内" in text:
                slot = "DOMESTIC"
            elif "境外" in text:
                slot = "OVERSEAS"

        # Build candidate code
        if slot:
            if quarter:
                candidate = f"RDU_PERF_{slot}_{indicator_type}_{period_suffix}{quarter}"
            else:
                candidate = f"RDU_PERF_{slot}_{indicator_type}_{period_suffix}"
        elif quarter:
            candidate = f"RDU_PERF_QUARTER_{indicator_type}_{period_suffix}{quarter}"
        else:
            candidate = f"RDU_PERF_TOTAL_{indicator_type}_{period_suffix}"

        # Validate against known codes
        code_set = {m["metric_code"] for m in metrics}
        if candidate in code_set:
            return candidate

        # Try without period suffix variations
        # e.g., "RDU_PERF_TOTAL_REV_T" vs "RDU_PERF_TOTAL_REV_T_1"
        for code in code_set:
            if (
                indicator_type in code
                and (slot in code if slot else "TOTAL" in code or "QUARTER" in code)
            ):
                # Rough match - check period suffix
                if period_suffix and period_suffix in code:
                    return code

        return None

    async def _run_supplementary_extraction(
        self,
        missing_metrics: list[dict],
        file_path: str,
        report_year: int,
        chapters: dict,
    ) -> list[dict]:
        """
        Supplementary extraction for metrics not found in the initial pass.
        Re-sends a focused prompt with all missing metrics and available chapter content.
        """
        if not missing_metrics:
            return []

        # Combine all available chapter content
        all_content_parts = []
        for chapter_key, chapter_data in chapters.items():
            text = chapter_data.get("text", "")
            if text:
                all_content_parts.append(text[:5000])  # Take first 5000 chars each

        if not all_content_parts:
            return []

        combined_content = "\n\n".join(all_content_parts)

        # Build a focused prompt
        from app.prompts.indicator_extract import (
            SYSTEM_PROMPT, build_year_mapping, build_metric_list,
            OUTPUT_INSTRUCTION,
        )
        parts = [
            build_year_mapping(report_year),
            "",
            build_metric_list(missing_metrics, report_year),
            "",
            "== 年报原文（综合摘要） ==",
            combined_content[:20000],
            "",
            OUTPUT_INSTRUCTION,
        ]
        user_prompt = "\n".join(parts)

        try:
            raw = await self.llm_service.chat(
                prompt=user_prompt,
                system_prompt=SYSTEM_PROMPT,
                purpose="common",
                extra_body=_NO_THINK,
                use_stream=True,
            )
            items = self._parse_llm_response(raw)
            mapped = self._map_to_standard_codes(items, missing_metrics)
            for item in mapped:
                item["category"] = "supplementary"
            logger.info("Supplementary extraction found %d additional items", len(mapped))
            return mapped
        except Exception as e:
            logger.error("Supplementary extraction failed: %s", e)
            return []

    def format_output(self, indicators: list[dict]) -> list[dict]:
        """
        Format extracted indicators into the final output JSON format:
        [{name, key, val, page}]

        Indicators without a value are excluded.
        """
        result = []
        for ind in indicators:
            val = ind.get("value", "")
            if not val:
                continue
            result.append({
                "name": ind.get("indicator_name", ""),
                "key": ind.get("indicator_code", ""),
                "val": val,
                "page": ind.get("source_page") or "",
            })
        return result
