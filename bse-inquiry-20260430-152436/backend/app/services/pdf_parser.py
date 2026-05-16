"""
PDF parser service - parse annual report PDFs using PyMuPDF + pdfplumber.

PyMuPDF (fitz): fast text extraction, TOC parsing, page indexing.
pdfplumber: accurate table extraction for targeted pages.
"""

import logging
import re
from typing import Optional

import fitz  # PyMuPDF
import pdfplumber

logger = logging.getLogger(__name__)

# Chapter keyword mapping for locating target sections in annual reports.
# Each key is a chapter identifier; values are lists of keywords to match.
CHAPTER_KEYWORDS = {
    "accounting_data": [
        "主要会计数据和财务指标",
        "主要会计数据",
        "主要财务指标",
        "管理层讨论与分析",
        "财务分析",
        "经营情况分析",
    ],
    "business_segment": [
        # 长词优先：避免被父章节"管理层讨论与分析"抢占
        "按产品分类分析",
        "按业务分类分析",
        "按行业分类分析",
        "按产品分类",
        "按业务分类",
        "按行业分类",
        "主营业务分析",
        "分产品",
        "分业务",
        "分行业",
        "收入构成",
        "管理层讨论与分析",
    ],
    "region_segment": [
        # 长词优先
        "按区域分类分析",
        "按地区分类分析",
        "按区域分类",
        "按地区分类",
        "分地区情况",
        "分区域情况",
        "分地区",
        "分区域",
        "地区营业",
        "区域营业",
    ],
    "subsidiary": [
        "主要控股参股公司",
        "控股参股公司",
        "主要子公司",
        "主要控股子公司",
    ],
    "quarterly": [
        "分季度主要财务指标",
        "分季度",
        "季度主要财务",
        "各季度主要财务",
    ],
    "cash_flow": [
        "现金流量表",
        "现金流量",
    ],
}

# Regex patterns for parsing printed TOC pages (Level 2 fallback).
TOC_PAGE_PATTERNS = [
    # "第一节 重要提示 .............. 5"
    re.compile(r'(第[一二三四五六七八九十\d]+[节章]\s*.+?)\s*[\.…·\s]{3,}(\d+)'),
    # "一、重要提示 .............. 5"
    re.compile(r'([一二三四五六七八九十\d]+[、.]\s*.+?)\s*[\.…·\s]{3,}(\d+)'),
    # General: "XXX .............. NN"
    re.compile(r'(.{4,40}?)\s*[\.…·]{3,}\s*(\d+)'),
]

# Max pages to extend beyond a chapter's detected end
CHAPTER_EXTEND_PAGES = 3
# Max pages for a single chapter (safety limit)
MAX_CHAPTER_PAGES = 20


class PDFParserService:
    """
    Service for parsing annual report PDF files.

    Uses a two-engine approach:
    - PyMuPDF (fitz) for fast TOC extraction and page text indexing
    - pdfplumber for accurate table extraction on targeted pages

    Chapter location uses a 3-level fallback strategy:
    - L1: Embedded TOC from PDF metadata
    - L2: Printed TOC page text parsing (regex)
    - L3: Full-text keyword search across all pages
    """

    async def parse(self, file_path: str, report_year: int = None) -> dict:
        """
        Parse a PDF file and return structured content with located chapters.

        Args:
            file_path: Path to the PDF file
            report_year: The reporting year (e.g. 2024). Used for year mapping.

        Returns:
            Dict with metadata, chapter_locations, chapters, missing_chapters.
        """
        logger.info("Opening PDF: %s", file_path)
        doc = fitz.open(file_path)
        total_pages = len(doc)
        logger.info("PDF opened: %d pages", total_pages)

        # Step 1: Extract TOC
        toc = self._extract_toc(doc)
        logger.info("Embedded TOC entries: %d", len(toc))

        # Step 2: Build page text index (for keyword search fallback)
        page_text_index = self._build_page_text_index(doc)

        # Step 3: Detect report year from text if not provided
        if not report_year:
            report_year = self._detect_report_year(page_text_index)
            logger.info("Detected report year: %s", report_year)

        # Step 4: Locate chapters using 3-level fallback
        chapter_locations = self._locate_chapters(toc, page_text_index, total_pages)
        logger.info(
            "Chapters located: %s",
            {k: v for k, v in chapter_locations.items()},
        )

        # Step 5: Extract content for each located chapter using pdfplumber
        chapters = {}
        for chapter_key, (start, end) in chapter_locations.items():
            content = self._extract_chapter_content(file_path, start, end)
            chapters[chapter_key] = content
            logger.info(
                "Chapter '%s' (pages %d-%d): text=%d chars, tables=%d",
                chapter_key, start + 1, end + 1,
                len(content.get("text", "")),
                len(content.get("tables", [])),
            )

        # Identify missing chapters
        all_keys = set(CHAPTER_KEYWORDS.keys())
        found_keys = set(chapter_locations.keys())
        missing_chapters = list(all_keys - found_keys)
        if missing_chapters:
            logger.warning("Missing chapters: %s", missing_chapters)

        doc.close()

        return {
            "metadata": {
                "total_pages": total_pages,
                "report_year_detected": report_year,
            },
            "chapter_locations": {
                k: list(v) for k, v in chapter_locations.items()
            },
            "chapters": chapters,
            "missing_chapters": missing_chapters,
        }

    def _extract_toc(self, doc: fitz.Document) -> list[tuple]:
        """
        Extract embedded TOC from PDF.

        Returns:
            List of (level, title, page_num_0based) tuples.
        """
        raw_toc = doc.get_toc()
        if not raw_toc:
            return []
        # Convert to 0-based page numbers
        result = []
        for level, title, page_num in raw_toc:
            # PyMuPDF returns 1-based page numbers
            result.append((level, title.strip(), max(0, page_num - 1)))
        return result

    def _build_page_text_index(self, doc: fitz.Document) -> dict[int, str]:
        """
        Build a page_num -> text mapping for all pages using PyMuPDF.
        Used for keyword-based chapter location fallback.
        """
        index = {}
        for i in range(len(doc)):
            try:
                text = doc[i].get_text("text")
                index[i] = text if text else ""
            except Exception as e:
                logger.warning("Failed to extract text from page %d: %s", i, e)
                index[i] = ""
        return index

    def _detect_report_year(self, page_text_index: dict[int, str]) -> Optional[int]:
        """
        Try to detect the report year from the first few pages.
        Looks for patterns like "2024年年度报告" or "2024 年 年度报告".
        """
        for page_num in range(min(5, len(page_text_index))):
            text = page_text_index.get(page_num, "")
            # Match "YYYY年年度报告" or "YYYY 年 年度报告"
            match = re.search(r'(20[12]\d)\s*年\s*年度报告', text)
            if match:
                return int(match.group(1))
            # Match "YYYY年度报告"
            match = re.search(r'(20[12]\d)\s*年度报告', text)
            if match:
                return int(match.group(1))
        return None

    def _locate_chapters(
        self,
        toc: list[tuple],
        page_text_index: dict[int, str],
        total_pages: int,
    ) -> dict[str, tuple[int, int]]:
        """
        Locate target chapters using 3-level fallback strategy.

        Returns:
            Dict of chapter_key -> (start_page_0based, end_page_0based)
        """
        locations = {}

        # Level 1: Embedded TOC matching
        if toc:
            locations = self._locate_from_toc(toc, total_pages)
            logger.info("L1 (TOC) located %d chapters", len(locations))

        # Level 2: Printed TOC page parsing (for chapters not found in L1)
        missing_keys = set(CHAPTER_KEYWORDS.keys()) - set(locations.keys())
        if missing_keys:
            l2_locations = self._locate_from_printed_toc(page_text_index, total_pages)
            for key, page_range in l2_locations.items():
                if key in missing_keys:
                    locations[key] = page_range
            logger.info(
                "L2 (printed TOC) added %d chapters",
                len(set(l2_locations.keys()) & missing_keys),
            )

        # Level 3: Full-text keyword search (for remaining missing chapters)
        missing_keys = set(CHAPTER_KEYWORDS.keys()) - set(locations.keys())
        if missing_keys:
            l3_locations = self._locate_from_keyword_search(
                page_text_index, missing_keys, total_pages
            )
            for key, page_range in l3_locations.items():
                locations[key] = page_range
            logger.info("L3 (keyword search) added %d chapters", len(l3_locations))

        return locations

    def _locate_from_toc(
        self, toc: list[tuple], total_pages: int
    ) -> dict[str, tuple[int, int]]:
        """
        Level 1: Match chapter keywords against embedded TOC entries.
        """
        locations = {}
        for chapter_key, keywords in CHAPTER_KEYWORDS.items():
            for i, (level, title, page_num) in enumerate(toc):
                if any(kw in title for kw in keywords):
                    # Determine end page: next sibling or parent entry
                    end_page = self._find_toc_end_page(toc, i, level, total_pages)
                    # Clamp and extend
                    end_page = min(
                        end_page + CHAPTER_EXTEND_PAGES,
                        page_num + MAX_CHAPTER_PAGES,
                        total_pages - 1,
                    )
                    locations[chapter_key] = (page_num, end_page)
                    break  # Take first match for each chapter
        return locations

    def _find_toc_end_page(
        self, toc: list[tuple], current_idx: int, current_level: int, total_pages: int
    ) -> int:
        """
        Find end page for a TOC entry: the page of the next entry at the same
        or higher level, minus 1.
        """
        for j in range(current_idx + 1, len(toc)):
            next_level, _, next_page = toc[j]
            if next_level <= current_level:
                return max(0, next_page - 1)
        # Last entry: use a reasonable default
        _, _, start_page = toc[current_idx]
        return min(start_page + 10, total_pages - 1)

    def _locate_from_printed_toc(
        self, page_text_index: dict[int, str], total_pages: int
    ) -> dict[str, tuple[int, int]]:
        """
        Level 2: Parse printed TOC pages (usually pages 2-8) to find chapter locations.
        """
        # Collect TOC-like entries from the first 10 pages
        toc_entries = []  # (title, page_number_in_report)
        for page_num in range(min(10, len(page_text_index))):
            text = page_text_index.get(page_num, "")
            for line in text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                for pattern in TOC_PAGE_PATTERNS:
                    match = pattern.match(line)
                    if match:
                        title = match.group(1).strip()
                        try:
                            ref_page = int(match.group(2)) - 1  # Convert to 0-based
                            if 0 <= ref_page < total_pages:
                                toc_entries.append((title, ref_page))
                        except ValueError:
                            pass
                        break

        if not toc_entries:
            return {}

        # Sort by page number
        toc_entries.sort(key=lambda x: x[1])

        # Match against chapter keywords
        locations = {}
        for chapter_key, keywords in CHAPTER_KEYWORDS.items():
            for i, (title, start_page) in enumerate(toc_entries):
                if any(kw in title for kw in keywords):
                    # End page: next entry's page - 1
                    if i + 1 < len(toc_entries):
                        end_page = toc_entries[i + 1][1] - 1
                    else:
                        end_page = start_page + 10
                    end_page = min(
                        end_page + CHAPTER_EXTEND_PAGES,
                        start_page + MAX_CHAPTER_PAGES,
                        total_pages - 1,
                    )
                    locations[chapter_key] = (start_page, end_page)
                    break
        return locations

    def _locate_from_keyword_search(
        self,
        page_text_index: dict[int, str],
        target_keys: set[str],
        total_pages: int,
    ) -> dict[str, tuple[int, int]]:
        """
        Level 3: Full-text keyword search across all pages.
        Finds the first occurrence of each chapter's keywords.
        """
        locations = {}
        for chapter_key in target_keys:
            keywords = CHAPTER_KEYWORDS.get(chapter_key, [])
            found_page = None
            for page_num in sorted(page_text_index.keys()):
                text = page_text_index[page_num]
                # Check if keyword appears in the first 30% of the page text
                # (chapter titles are typically near the top)
                check_text = text[: max(200, len(text) // 3)]
                if any(kw in check_text for kw in keywords):
                    found_page = page_num
                    break

            if found_page is not None:
                end_page = min(
                    found_page + 10,
                    found_page + MAX_CHAPTER_PAGES,
                    total_pages - 1,
                )
                locations[chapter_key] = (found_page, end_page)

        return locations

    def _extract_chapter_content(
        self, file_path: str, start_page: int, end_page: int
    ) -> dict:
        """
        Use pdfplumber to extract text and tables from a specific page range.

        Args:
            file_path: Path to the PDF file
            start_page: Start page (0-based)
            end_page: End page (0-based, inclusive)

        Returns:
            Dict with 'text' (str) and 'tables' (list of dicts).
        """
        all_text_parts = []
        all_tables = []

        try:
            with pdfplumber.open(file_path) as pdf:
                for page_idx in range(start_page, min(end_page + 1, len(pdf.pages))):
                    page = pdf.pages[page_idx]

                    # Extract text
                    text = page.extract_text()
                    if text:
                        all_text_parts.append(
                            f"--- 第{page_idx + 1}页 ---\n{text}"
                        )

                    # Extract tables
                    tables = page.extract_tables()
                    if tables:
                        for table_idx, table in enumerate(tables):
                            if not table or len(table) < 2:
                                continue
                            # Format table as structured text
                            formatted = self._format_table(table, page_idx)
                            if formatted:
                                all_tables.append({
                                    "page": page_idx + 1,
                                    "table_index": table_idx,
                                    "formatted": formatted,
                                    "raw": table,
                                })
        except Exception as e:
            logger.error(
                "pdfplumber extraction failed for pages %d-%d: %s",
                start_page, end_page, e,
            )

        combined_text = "\n\n".join(all_text_parts)

        # Append formatted tables to text for LLM consumption
        if all_tables:
            table_text_parts = []
            for t in all_tables:
                table_text_parts.append(
                    f"[表格-第{t['page']}页]\n{t['formatted']}"
                )
            combined_text += "\n\n" + "\n\n".join(table_text_parts)

        return {
            "text": combined_text,
            "tables": all_tables,
        }

    def _format_table(self, table: list[list], page_idx: int) -> str:
        """
        Format a raw table (list of rows) into a readable text representation.
        Handles None cells and normalizes whitespace.
        """
        if not table:
            return ""

        rows = []
        for row in table:
            cells = []
            for cell in row:
                if cell is None:
                    cells.append("")
                else:
                    # Clean whitespace and newlines within cells
                    cleaned = str(cell).replace("\n", " ").strip()
                    cells.append(cleaned)
            rows.append(" | ".join(cells))

        return "\n".join(rows)
