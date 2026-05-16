"""
Prompt templates for extracting financial indicators from annual report content.

Each category of indicators has a dedicated prompt template that includes:
- Year mapping (T/T-1/T-2 to actual years)
- Indicator list for that category
- Special instructions for placeholder name mapping (BIZ/REGION/COMPANY)
"""

# Shared system prompt for all extraction batches
SYSTEM_PROMPT = (
    "你是一位从上市公司年报PDF中提取财务指标数据的专家。\n"
    "请严格按照给定的指标列表，从年报原文中精确提取对应的财务数值。\n"
    "遵守以下规则（违反任何一条都会严重影响数据质量）：\n"
    "1. 【严禁编造】仅提取能从原文表格或正文中直接确认的指标。"
    "如果原文中没有明确列出某指标的数据，该指标必须跳过，不得在JSON中输出，严禁用近似值、合计值或其他指标的数据替代。\n"
    "2. 【跨期分项注意】T-1期、T-2期的分产品/分地区/分子公司明细数据，"
    "如果原文表格只提供了T期的分项明细而没有提供T-1/T-2期的对应明细，则T-1/T-2期的相关占位符指标必须全部跳过，不得用T期数据或合计数据填充。\n"
    "3. 【区域映射注意】'区域1-5'必须对应原文中明确列出的具体地理区域（如华东、华北等）。"
    "如果原文中只有'境内/境外'分类而没有区域1-5的明细，则所有区域1-5的指标必须跳过，不得将境内/境外数据映射到区域1-5。\n"
    "4. 【T+1期注意】如果原文中没有披露T+1年第一季度的数据，则T+1期Q1的所有指标必须跳过。\n"
    "5. 保留数值的原始格式（如千分位逗号、百分号、单位等）\n"
    "6. 输出严格的JSON数组格式，不要输出其他文字\n"
    "7. 每个元素包含 name(标准指标名)、key(指标代码)、val(提取的值)"
)

# Year mapping template
YEAR_MAPPING_TEMPLATE = (
    "== 年份映射 ==\n"
    "本年报的报告期为{report_year}年。\n"
    "T期 = {report_year}年（即\"本报告期\"、\"{report_year}年度\"）\n"
    "T-1期 = {report_year_m1}年（即\"上年同期\"、\"上年度\"、\"{report_year_m1}年度\"）\n"
    "T-2期 = {report_year_m2}年\n"
    "T+1期Q1 = {report_year_p1}年第一季度"
)


def build_year_mapping(report_year: int) -> str:
    """Build the year mapping section of the prompt."""
    return YEAR_MAPPING_TEMPLATE.format(
        report_year=report_year,
        report_year_m1=report_year - 1,
        report_year_m2=report_year - 2,
        report_year_p1=report_year + 1,
    )


def build_metric_list(metrics: list[dict], report_year: int) -> str:
    """
    Build the indicator list section.

    Args:
        metrics: List of dicts with 'metric_name' and 'metric_code' keys.
        report_year: The report year for year substitution hints.
    """
    lines = [f"== 待提取指标（共{len(metrics)}项） =="]
    for i, m in enumerate(metrics, 1):
        name = m["metric_name"]
        code = m["metric_code"]
        # Add year hint
        hint = _year_hint(name, report_year)
        if hint:
            lines.append(f"{i}. {name} ({code}) - {hint}")
        else:
            lines.append(f"{i}. {name} ({code})")
    return "\n".join(lines)


def _year_hint(metric_name: str, report_year: int) -> str:
    """Generate a year hint for a metric name."""
    if "T+1期" in metric_name:
        return f"即{report_year + 1}年"
    if "T-2期" in metric_name:
        return f"即{report_year - 2}年"
    if "T-1期" in metric_name:
        return f"即{report_year - 1}年"
    if "T期" in metric_name:
        return f"即{report_year}年"
    return ""


def build_content_section(chapter_contents: list[tuple[str, str]]) -> str:
    """
    Build the annual report content section.

    Args:
        chapter_contents: List of (chapter_label, text_content) tuples.
    """
    lines = ["== 年报原文 =="]
    for label, content in chapter_contents:
        # Truncate if too long (keep under ~15000 chars per chapter)
        if len(content) > 15000:
            content = content[:15000] + "\n...(内容过长已截断)"
        lines.append(f"--- {label} ---")
        lines.append(content)
        lines.append("")
    return "\n".join(lines)


# Output instruction shared by all categories
OUTPUT_INSTRUCTION = (
    "== 输出要求 ==\n"
    "请以JSON数组格式输出，每个元素包含:\n"
    '- "name": 标准指标名（与上面列表中的指标名保持一致）\n'
    '- "key": 指标代码（与上面列表中的code保持一致）\n'
    '- "val": 从原文提取的原始值（保留原始格式，如"511,810,505.43元"、"31.58%"）\n'
    '- "page": 该指标所在的PDF页码（从原文的"--- 第X页 ---"标记中获取）\n'
    "\n"
    "【重要】如果某个指标在原文中没有找到对应的数据，该指标必须不输出（即JSON数组中不包含该元素）。\n"
    "严禁用以下方式填充缺失数据：\n"
    "- 用其他年份的数据替代（如用T期数据填T-1期）\n"
    "- 用合计数据替代分项数据（如用主营业务收入总额替代某个产品的收入）\n"
    "- 用近似值或估算值替代\n"
    "- 将境内/境外数据映射到区域1-5\n"
    "\n"
    "仅输出JSON数组，不要输出任何其他文字或解释。"
)

# Special instructions for business/region/subsidiary categories
BIZ_MAPPING_INSTRUCTION = (
    "== 名称映射说明 ==\n"
    "指标列表中的\"业务1（产品）\"、\"业务2（产品）\"等是占位符。\n"
    "请按年报原文中\"分产品\"或\"分业务\"表格的数据行顺序进行映射：\n"
    "- 原文表格中按营业收入从高到低排列的第1个业务/产品 → 对应\"业务1\"的所有指标\n"
    "- 第2个 → 对应\"业务2\"\n"
    "- ...最多取前5个业务/产品\n"
    "- 如果原文中不足5个，多余的占位符请跳过\n"
    "\n"
    "请在JSON数组末尾额外附加一个映射对象（不计入指标数组）：\n"
    '{"_name_mapping": {"BIZ01": "第1个业务的真实名称", "BIZ02": "第2个...", ...}}'
)

REGION_MAPPING_INSTRUCTION = (
    "== 名称映射说明 ==\n"
    "指标列表中的\"区域1\"、\"区域2\"等是占位符。\n"
    "请按年报原文中\"分地区\"表格的数据行顺序进行映射：\n"
    "- 原文表格中按营业收入从高到低排列的第1个地区 → 对应\"区域1\"的所有指标\n"
    "- 第2个 → 对应\"区域2\"\n"
    "- ...最多取前5个地区\n"
    "- 注意：\"境内\"和\"境外\"是独立指标，不要混入区域1-5中\n"
    "\n"
    "请在JSON数组末尾额外附加一个映射对象：\n"
    '{"_name_mapping": {"REGION01": "第1个地区的真实名称", "REGION02": "第2个...", ...}}'
)

COMPANY_MAPPING_INSTRUCTION = (
    "== 名称映射说明 ==\n"
    "指标列表中的\"公司1\"、\"公司2\"等是占位符（注：用户提供的JSON中可能显示为\"子公司1\"等）。\n"
    "请按年报原文中\"主要控股参股公司\"表格的数据行顺序进行映射：\n"
    "- 原文表格中按营业收入从高到低排列的第1家子公司 → 对应\"公司1\"的所有指标\n"
    "- 第2家 → 对应\"公司2\"\n"
    "- ...最多取前5家子公司\n"
    "\n"
    "请在JSON数组末尾额外附加一个映射对象：\n"
    '{"_name_mapping": {"COMPANY01": "第1家子公司的全称", "COMPANY02": "第2家...", ...}}'
)

# Category ID to mapping instruction
# 注意: 这里的 cat_id 必须与 DB 表 rdu_categories 保持一致：
#   2 = 整体业绩, 3 = 现金流/净利润差异, 4 = 分季度/期后,
#   5 = 分业务（产品）, 6 = 分区域/境内外, 7 = 分子公司
CATEGORY_MAPPING_INSTRUCTIONS = {
    5: BIZ_MAPPING_INSTRUCTION,      # 分业务（产品）
    6: REGION_MAPPING_INSTRUCTION,   # 分区域/境内外
    7: COMPANY_MAPPING_INSTRUCTION,  # 分子公司
}

# Category ID to chapter keys needed
# 章节键见 backend/app/services/pdf_parser.py 中的 CHAPTER_KEYWORDS
CATEGORY_CHAPTER_MAP = {
    2: ["accounting_data"],            # 整体业绩 → 主要会计数据/财务分析
    3: ["cash_flow", "accounting_data"],  # 现金流/净利润差异 → 现金流量表+主要会计数据(净利润)
    4: ["quarterly"],                  # 分季度/期后 → 分季度主要财务指标
    5: ["business_segment"],           # 分业务（产品） → 主营业务分析/分产品
    6: ["region_segment"],             # 分区域/境内外 → 分地区/按区域分类
    7: ["subsidiary"],                 # 分子公司 → 主要控股参股公司
}

# Category ID to label（与 DB rdu_categories.name 对齐）
CATEGORY_LABELS = {
    2: "整体业绩",
    3: "现金流/净利润差异",
    4: "分季度/期后",
    5: "分业务（产品）",
    6: "分区域/境内外",
    7: "分子公司",
}

# Chapter key to display label
CHAPTER_LABELS = {
    "accounting_data": "主要会计数据和财务指标",
    "business_segment": "主营业务分析/分产品/分业务",
    "region_segment": "分地区营业",
    "subsidiary": "主要控股参股公司",
    "quarterly": "分季度主要财务指标",
    "cash_flow": "现金流量表",
}


def build_extraction_prompt(
    category_id: int,
    metrics: list[dict],
    chapters: dict[str, dict],
    report_year: int,
) -> tuple[str, str]:
    """
    Build a complete (system_prompt, user_prompt) pair for a given category.

    Args:
        category_id: The metric category ID (1, 2, 4, or 5).
        metrics: List of metric definitions for this category.
        chapters: The parsed chapters dict from PDFParserService.
        report_year: The report year.

    Returns:
        Tuple of (system_prompt, user_prompt).
    """
    parts = []

    # Year mapping
    parts.append(build_year_mapping(report_year))
    parts.append("")

    # Metric list
    parts.append(build_metric_list(metrics, report_year))
    parts.append("")

    # Mapping instruction (for BIZ/REGION/COMPANY categories)
    mapping_inst = CATEGORY_MAPPING_INSTRUCTIONS.get(category_id)
    if mapping_inst:
        parts.append(mapping_inst)
        parts.append("")

    # Chapter contents
    chapter_keys = CATEGORY_CHAPTER_MAP.get(category_id, [])
    chapter_contents = []
    for ck in chapter_keys:
        if ck in chapters and chapters[ck].get("text"):
            label = CHAPTER_LABELS.get(ck, ck)
            chapter_contents.append((label, chapters[ck]["text"]))

    if chapter_contents:
        parts.append(build_content_section(chapter_contents))
    else:
        parts.append("== 年报原文 ==\n（未找到对应章节内容）")

    parts.append("")

    # Output instruction
    parts.append(OUTPUT_INSTRUCTION)

    user_prompt = "\n".join(parts)
    return SYSTEM_PROMPT, user_prompt
