import logging
import os
import re
import json
from typing import Dict, List, Any, Optional, Tuple

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from app.config import settings
from app.analysis_manager import analysis_manager

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are PaperWise's Knowledge Assistant, an expert scholar investigating the research paper: "{paper_title}".

You have access to 4 specialized local research tools:
1. `retrieve_paper_chunks`: Search relevant text passages across the paper with exact page numbers and section headings.
2. `lookup_analysis_report`: Query our pre-computed peer review evaluation (methodology, evidence quality, gaps, novelty, critical review, verdict).
3. `lookup_tables_and_figures`: Query extracted Markdown tables and figure diagrams with numerical metrics.
4. `get_paper_metadata`: View paper title, authors, domain, publication venue, and citation metrics.

Guidelines:
- Ground your answers in evidence retrieved from the paper and our analysis report.
- When referencing specific text, claims, or data from the paper, cite the exact page and section using `[Page X: Section Title]` format (e.g. `[Page 2: Quantifying selectivity by SpyCI-LAMBS]` or `[Page 7: C5 LanMs reject lanthanum]`). Always include both the page and section title when available.
- When referencing reviewer critiques or debate verdicts, cite the relevant section using `[Analysis Report: Section Name]` or `[Section Name]` (e.g. `[Analysis Report: Methodological Evaluation]` or `[Critical Review]`).
- If the user provides specific context from a highlighted passage, address that context directly while leveraging tools for broader connections.
- Be concise, scholarly, objective, and clear. If a detail is missing or not covered in the paper, state that honestly.
"""

class KnowledgeChatAgent:
    """
    Expert Agent for exploring and querying a research paper using a LangGraph ReAct Deep Agent.
    Operates with local artifact storage and retrieval, and uses the configured Google Gemini model
    (defaulting to settings.gemini_model) via the external Gemini API for reasoning and inference.
    """
    
    def __init__(self, analysis_id: str):
        self.analysis_id = analysis_id
        llm_kwargs = {
            "model": settings.gemini_model,
            "google_api_key": settings.gemini_api_key,
            "temperature": settings.gemini_temperature,
            "timeout": settings.request_timeout
        }
        thinking_level = settings.get_thinking_level("chat")
        if thinking_level:
            llm_kwargs["thinking_level"] = thinking_level
        self.llm = ChatGoogleGenerativeAI(**llm_kwargs)

    async def _load_data(self):
        parsed_content = await analysis_manager.get_parsed_content_async(self.analysis_id)
        if not parsed_content:
            parsed_content = analysis_manager.get_parsed_content(self.analysis_id) or {}
        comprehensive = analysis_manager.get_analysis_result(self.analysis_id, "comprehensive") or {}
        metadata = analysis_manager.get_analysis_metadata(self.analysis_id) or {}
        return parsed_content, comprehensive, metadata

    @staticmethod
    def _is_valid_section(title: str) -> bool:
        """Validate if a string is a legitimate section title rather than an author, DOI, or citation line."""
        if not title:
            return False
        t = title.strip().strip('*').strip('#').strip()
        if len(t) < 3 or len(t) > 70:
            return False
        if re.search(r'\d+,\s*\d+-\d+\s*\(\d{4}\)', t):
            return False
        if re.search(r'^\d+[\s,]+\d+', t):
            return False
        if re.search(r'https?://|doi\.org', t, re.I):
            return False
        if re.search(r'^(fig|table|extended data|article|received|accepted|published|supplementary)', t, re.I):
            return False
        return True

    @staticmethod
    def _normalize_or_generate_chunks(parsed_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Normalize parsed chunks or dynamically slice text_content if chunks are missing."""
        chunks = parsed_content.get("chunks", [])
        raw_text = parsed_content.get("text_content", "")
        
        def _extract_snippet(text: str) -> str:
            clean_lines = [l.strip() for l in text.split('\n') if l.strip() and not l.strip().startswith(('#', '|', '---'))]
            first_line = clean_lines[0] if clean_lines else text.strip()
            first_sentence = first_line.split('.')[0].strip()
            snippet = re.sub(r'[*_#|`]', '', first_sentence)[:80].strip()
            return snippet or first_line[:60].strip()

        # If chunks are missing or empty, dynamically slice text_content by page headers
        if not chunks and raw_text:
            pages = re.split(r'--- Page (\d+) ---\n', raw_text)
            current_sec = "Introduction"
            generated_chunks = []
            
            for idx in range(1, len(pages), 2):
                p_num = int(pages[idx])
                p_text = pages[idx + 1]
                
                # Check for section headings on this page
                for line in p_text.split('\n'):
                    l_str = line.strip()
                    hm = re.match(r'^(#{1,4})\s+([^\n]+)', l_str)
                    if hm:
                        candidate = hm.group(2).strip()
                        if KnowledgeChatAgent._is_valid_section(candidate):
                            current_sec = candidate
                    elif l_str.startswith('**') and l_str.endswith('**'):
                        candidate = l_str.strip('*').strip()
                        if KnowledgeChatAgent._is_valid_section(candidate):
                            current_sec = candidate
                
                paras = p_text.split('\n\n')
                block = []
                block_len = 0
                for para in paras:
                    p_clean = para.strip()
                    if not p_clean:
                        continue
                    block.append(p_clean)
                    block_len += len(p_clean)
                    if block_len >= 800:
                        combined = '\n\n'.join(block)
                        generated_chunks.append({
                            "text": combined,
                            "page": p_num,
                            "section": current_sec,
                            "snippet": _extract_snippet(combined)
                        })
                        block = []
                        block_len = 0
                if block:
                    combined = '\n\n'.join(block)
                    generated_chunks.append({
                        "text": combined,
                        "page": p_num,
                        "section": current_sec,
                        "snippet": _extract_snippet(combined)
                    })
            chunks = generated_chunks

        # Normalize chunks for search
        normalized_chunks = []
        for i, c in enumerate(chunks):
            if isinstance(c, dict):
                text = c.get("text") or c.get("content") or ""
                meta = c.get("metadata", {})
                page = meta.get("page") or c.get("page") or 1
                section = meta.get("section") or c.get("section") or ""
                snippet = meta.get("snippet") or c.get("snippet") or ""
            elif hasattr(c, "page_content"):
                text = c.page_content
                meta = getattr(c, "metadata", {})
                page = meta.get("page", 1)
                section = meta.get("section", "")
                snippet = meta.get("snippet", "")
            else:
                text = str(c)
                page = 1
                section = ""
                snippet = ""
            
            if not snippet and text:
                snippet = _extract_snippet(text)

            normalized_chunks.append({
                "text": text,
                "page": int(page),
                "section": section,
                "snippet": snippet,
                "id": i
            })
        return normalized_chunks

    def _build_tools(self, parsed_content: Dict[str, Any], comprehensive: Dict[str, Any], metadata: Dict[str, Any]):
        normalized_chunks = self._normalize_or_generate_chunks(parsed_content)
        tables = parsed_content.get("tables", [])
        figures = parsed_content.get("figures", [])

        @tool
        def retrieve_paper_chunks(query: str, page_number: Optional[int] = None) -> str:
            """Search for relevant text passages in the research paper.
            Optionally filter by exact page_number (1-indexed).
            Returns matching passages with exact page numbers, section headings, and key quotes."""
            if not normalized_chunks:
                raw_text = parsed_content.get("text_content", "")
                if raw_text:
                    return f"[Full Text Excerpt]\n{raw_text[:2500]}..."
                return "No text chunks available for this paper."
            
            q_clean = query.lower().strip()
            tokens = re.findall(r'\w{3,}', q_clean)
            scored = []
            for c in normalized_chunks:
                if page_number is not None and c["page"] != int(page_number):
                    continue
                c_text = c["text"]
                if not c_text:
                    continue
                text_lower = c_text.lower()
                sec_lower = (c.get("section") or "").lower()
                
                score = 0
                # Exact phrase match boost
                if len(tokens) > 1 and q_clean in text_lower:
                    score += 20
                # Token frequency with saturation cap
                for t in tokens:
                    count = text_lower.count(t)
                    score += min(count, 5) * 2
                    if t in sec_lower:
                        score += 5
                
                if score > 0 or not tokens:
                    scored.append((score, c["page"], c["section"], c["snippet"], c_text))
            
            if not scored:
                if page_number is not None:
                    return f"No text passages found on Page {page_number} matching query: '{query}'."
                return f"No text passages found matching query: '{query}'."
            
            scored.sort(key=lambda x: x[0], reverse=True)
            top_matches = scored[:5]
            
            output = []
            for score, page, sec, snip, text in top_matches:
                sec_header = f" | Section: {sec}" if sec else ""
                snip_header = f"Key Passage: \"{snip}\"\n" if snip else ""
                output.append(f"--- [Page {page}{sec_header}] ---\n{snip_header}{text.strip()}")
            return "\n\n".join(output)

        @tool
        def lookup_analysis_report(section: Optional[str] = None) -> str:
            """Look up sections of our pre-computed peer review analysis report.
            Valid section names:
            - 'executive_summary': High-level problem and innovation summary
            - 'methodological_evaluation': In-depth methodology critique, rigor, reproducibility
            - 'evidence_quality': Empirical findings, baseline comparisons, statistical soundness
            - 'gap_analysis': Addressed and unaddressed research gaps
            - 'novelty_assessment': Key technical innovations and novelty score
            - 'impact_assessment': Field impact and practical significance
            - 'critical_review': Strengths, weaknesses, and potential flaws
            - 'overall_verdict': Final consensus score and verdict
            - 'all': Complete summary of all sections"""
            if not comprehensive:
                return "Analysis report has not been generated or is empty."
            
            # The report structure may have comprehensive_analysis or be direct
            report_data = comprehensive.get("comprehensive_analysis") or comprehensive
            if not isinstance(report_data, dict):
                return str(report_data)

            sec_key = (section or "").lower().strip()
            
            # Direct key mapping
            key_map = {
                "summary": "executive_summary",
                "executive_summary": "executive_summary",
                "methodology": "methodological_evaluation",
                "methodological_evaluation": "methodological_evaluation",
                "evidence": "evidence_quality",
                "evidence_quality": "evidence_quality",
                "results": "evidence_quality",
                "gaps": "gap_analysis",
                "gap_analysis": "gap_analysis",
                "novelty": "novelty_assessment",
                "novelty_assessment": "novelty_assessment",
                "impact": "impact_assessment",
                "impact_assessment": "impact_assessment",
                "critical": "critical_review",
                "critical_review": "critical_review",
                "verdict": "overall_verdict",
                "overall_verdict": "overall_verdict"
            }
            
            target_key = key_map.get(sec_key)
            if target_key and target_key in report_data:
                val = report_data[target_key]
                if isinstance(val, dict):
                    lines = [f"## {target_key.replace('_', ' ').title()}"]
                    for k, v in val.items():
                        lines.append(f"**{k.replace('_', ' ').title()}**: {v}")
                    return "\n".join(lines)
                return f"## {target_key.replace('_', ' ').title()}\n{val}"
            
            # Return overview of key sections if requested or unspecified
            output = []
            for k in ["executive_summary", "methodological_evaluation", "evidence_quality", "critical_review", "overall_verdict"]:
                if k in report_data:
                    val = report_data[k]
                    title = k.replace('_', ' ').title()
                    if isinstance(val, dict):
                        summary_snippet = " | ".join(f"{vk}: {vv}" for vk, vv in list(val.items())[:2])
                        output.append(f"### {title}\n{summary_snippet}")
                    else:
                        output.append(f"### {title}\n{str(val)[:300]}...")
            return "\n\n".join(output) if output else json.dumps(report_data, indent=2)[:2000]

        @tool
        def lookup_tables_and_figures(query: str) -> str:
            """Inspect structured Markdown tables and figures extracted from the paper.
            Use this when the user asks about specific tables (e.g. Table 1), figures,
            experimental benchmark numbers, or quantitative results."""
            results = []
            query_lower = query.lower()
            
            # Match tables
            for idx, tbl in enumerate(tables):
                page = tbl.get("page", "?")
                tbl_md = tbl.get("markdown") or ""
                # If markdown not pre-rendered, format from data
                if not tbl_md and "data" in tbl and isinstance(tbl["data"], list):
                    rows = tbl["data"]
                    if rows:
                        header = "| " + " | ".join(str(c) for c in rows[0]) + " |"
                        sep = "| " + " | ".join("---" for _ in rows[0]) + " |"
                        body = "\n".join("| " + " | ".join(str(c) for c in r) + " |" for r in rows[1:10])
                        tbl_md = f"{header}\n{sep}\n{body}"
                
                if query_lower in tbl_md.lower() or f"table {idx+1}" in query_lower or not query_lower:
                    results.append(f"### Table on Page {page}\n{tbl_md}")
            
            # Match figures
            for idx, fig in enumerate(figures):
                page = fig.get("page", "?")
                desc = fig.get("description") or fig.get("caption") or ""
                ocr = fig.get("ocr_text") or ""
                combined = f"{desc} {ocr}".strip()
                if query_lower in combined.lower() or f"figure {idx+1}" in query_lower:
                    results.append(f"### Figure on Page {page}\n**Description**: {desc}\n**Diagram Text**: {ocr}")
            
            if not results:
                if tables:
                    return f"Found {len(tables)} tables in paper, but none matched query '{query}'. First table:\n{tables[0].get('markdown', '')[:500]}"
                return "No structured tables or figures found in this document."
                
            return "\n\n".join(results[:4])

        @tool
        def get_paper_metadata() -> str:
            """Get metadata about the paper, including title, authors, publication venue,
            academic domain classification, and external citation metrics."""
            paper_info = metadata.get("paper_info", {})
            title = paper_info.get("title", "Unknown")
            author = paper_info.get("author") or paper_info.get("authors") or "Unknown"
            pages = paper_info.get("pages", "Unknown")
            field = metadata.get("detected_field") or metadata.get("field") or "Research"
            enrichment = metadata.get("enrichment", {})
            
            lines = [
                f"**Title**: {title}",
                f"**Authors**: {author}",
                f"**Pages**: {pages}",
                f"**Field**: {field}"
            ]
            if enrichment:
                if "citation_count" in enrichment:
                    lines.append(f"**Citations**: {enrichment['citation_count']}")
                if "venue" in enrichment:
                    lines.append(f"**Venue**: {enrichment['venue']}")
            return "\n".join(lines)

        return [retrieve_paper_chunks, lookup_analysis_report, lookup_tables_and_figures, get_paper_metadata]

    async def chat(self, message: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Process a chat message using the LangGraph ReAct Deep Agent.
        
        Args:
            message: Current user message.
            history: Previous conversation history.
            
        Returns:
            Dict[str, Any]: {"answer": str, "sources": List[str]}
        """
        if history is None:
            history = []

        try:
            parsed_content, comprehensive, metadata = await self._load_data()
            paper_title = metadata.get("paper_info", {}).get("title", "Research Paper")
            tools = self._build_tools(parsed_content, comprehensive, metadata)

            prompt = (
                f"You are the PaperWise Knowledge Research Assistant for the paper: '{paper_title}'. "
                "You help researchers deeply understand, explore, and critique academic papers.\n\n"
                "Grounding Rules:\n"
                "1. PRIMARY SOURCE (The Research Paper): Always ground your answers first and foremost in the actual paper text and data using `retrieve_paper_chunks` and `lookup_tables_and_figures`. When the user asks about methodology, experiments, results, findings, or claims, search the paper text first and explain what the authors actually did in the study.\n"
                "2. PDF CITATIONS: Whenever citing facts, methods, or findings from the paper, cite the exact page and section from the tool outputs in clean square brackets, e.g. [Page 2: Snapshots of the LanM selectivity landscape] or [Page 12: Methods]. CRITICAL: NEVER wrap citations in backticks (do NOT write `[Page X]` or ```code```). Plain square brackets [Page X: Section] are required so they become clickable hyperlinks.\n"
                "3. AI PEER REVIEW REPORT: Use `lookup_analysis_report` ONLY when the user specifically asks for critique, limitations, strengths/weaknesses, peer review evaluation, or consensus score, OR as a short supplementary note. When citing the review report, cite it sparingly in plain brackets as [Analysis Report: Section Name] (e.g. [Analysis Report: Methodological Evaluation]). Never substitute the peer review critique in place of the authors' own methodology and findings.\n"
                "4. FORMATTING & MATH: Format mathematical formulas using standard LaTeX math enclosed in single dollar signs for inline ($formula$) or double dollar signs for display ($$formula$$). Use markdown bullet points (- or *) for lists without adding 4-space indentation to regular continuation text.\n"
                "5. NUMERICAL & BENCHMARK DATA: When quantitative data or benchmark comparisons are discussed, consult `lookup_tables_and_figures` and present structured data.\n"
                "6. Always be clear and academically rigorous, distinguishing between what the authors published in the paper and what the automated peer review evaluated."
            )

            agent = create_react_agent(
                model=self.llm,
                tools=tools,
                prompt=prompt
            )

            # Assemble message history
            lang_messages = []
            for h in history[-8:]:
                role = h.get("role")
                content = self._extract_text_content(h.get("content", ""))
                if role == "user":
                    lang_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    lang_messages.append(AIMessage(content=content))
            
            clean_message = self._extract_text_content(message)
            lang_messages.append(HumanMessage(content=clean_message))
            
            logger.info(f"🤖 Invoking LangGraph Deep Chat Agent for paper {self.analysis_id}")
            try:
                result = await agent.ainvoke({"messages": lang_messages})
            except Exception as invoke_err:
                err_str = str(invoke_err)
                if "Thinking level is not supported" in err_str or "INVALID_ARGUMENT" in err_str:
                    logger.warning(f"Thinking level not supported for {settings.gemini_model}, retrying without thinking_level: {err_str}")
                    fallback_llm = ChatGoogleGenerativeAI(
                        model=settings.gemini_model,
                        google_api_key=settings.gemini_api_key,
                        temperature=settings.gemini_temperature,
                        timeout=settings.request_timeout
                    )
                    agent = create_react_agent(model=fallback_llm, tools=tools, prompt=prompt)
                    result = await agent.ainvoke({"messages": lang_messages})
                else:
                    raise invoke_err
            
            # Retrieve final assistant message
            response_messages = result.get("messages", [])
            final_content = "I could not formulate an answer."
            for m in reversed(response_messages):
                if isinstance(m, AIMessage) and m.content:
                    extracted = self._extract_text_content(m.content).strip()
                    if extracted:
                        final_content = extracted
                        break

            # Extract citations from tool outputs and answer text
            normalized_chunks = self._normalize_or_generate_chunks(parsed_content)
            sources, source_details = self._extract_sources(response_messages, final_content, normalized_chunks)
            
            return {
                "answer": final_content,
                "sources": sources,
                "source_details": source_details
            }
            
        except Exception as e:
            logger.error(f"Error in LangGraph KnowledgeChatAgent: {e}", exc_info=True)
            raise e

    @staticmethod
    def _extract_text_content(content: Any) -> str:
        """Extract clean text string from strings, list of content blocks, dicts, or stringified reprs."""
        if content is None:
            return ""
        if isinstance(content, list):
            if not content:
                return ""
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    if "text" in item:
                        parts.append(str(item["text"]))
                    elif "content" in item:
                        parts.append(str(item["content"]))
                elif hasattr(item, "text"):
                    parts.append(str(item.text))
            return "".join(parts)
        elif isinstance(content, dict):
            if "text" in content:
                return str(content["text"])
            if "content" in content:
                return str(content["content"])
        
        # If it's a string, check if it's a stringified list of dicts like:
        # "[{'type': 'text', 'text': '...'}]"
        if isinstance(content, str):
            trimmed = content.strip()
            if (trimmed.startswith("[{") or trimmed.startswith("{")) and ("'text':" in trimmed or '"text":' in trimmed):
                try:
                    import ast
                    parsed = ast.literal_eval(trimmed)
                    if isinstance(parsed, (list, dict)):
                        extracted = KnowledgeChatAgent._extract_text_content(parsed)
                        if extracted:
                            return extracted
                except Exception:
                    pass
                
                # Regex fallback if ast.literal_eval fails (e.g. unescaped newlines or quotes)
                match = re.search(r"['\"]text['\"]\s*:\s*(['\"])(.*?)\1(?:\s*,\s*['\"]extras|\s*})", trimmed, re.DOTALL)
                if match:
                    raw_text = match.group(2)
                    return raw_text.replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'")

            return content
            
        return str(content)

    def _extract_sources(
        self, 
        messages: List[Any], 
        answer_text: str, 
        normalized_chunks: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[List[str], List[Dict[str, Any]]]:
        """Extract exact page citations and analysis sections for UI badges and deep links."""
        source_labels = []
        source_details = []
        seen_keys = set()
        
        # Build page chunk map to match section & snippet
        page_chunk_map: Dict[int, List[Dict[str, Any]]] = {}
        if normalized_chunks:
            for c in normalized_chunks:
                p = c.get("page", 1)
                if p not in page_chunk_map:
                    page_chunk_map[p] = []
                page_chunk_map[p].append(c)

        # 1. Look for granular in-text citations: [Page X: Section] or [Page X]
        # The section capture group deliberately excludes any embedded "Page " to prevent
        # malformed labels like "Page 2: Page 3: Fig 1". It also stops at commas/semicolons.
        granular_matches = re.findall(
            r'\[?Page\s+(\d+)(?:[,\s:]+§?\s*([^\]\n,;]+?)(?=\s*(?:,\s*Page|\s+Page|\]|$)))?(?:\]|(?=\s*\[))',
            answer_text,
            re.IGNORECASE
        )
        for p_str, sec_str in granular_matches:
            try:
                page_num = int(p_str)
            except ValueError:
                continue
            
            sec_clean = sec_str.strip() if sec_str else ""
            # Remove any trailing punctuation and length-cap at 80 chars
            sec_clean = re.sub(r'[\.\;\)\]]+$', '', sec_clean).strip()[:80]
            # If the "section" still starts with "Page", it's a misparse — discard it
            if re.match(r'^Page\s+\d+', sec_clean, re.IGNORECASE):
                sec_clean = ""
            
            # Find matching snippet and fill section if omitted
            matched_snippet = ""
            matched_section = sec_clean
            if page_num in page_chunk_map:
                chunks_for_page = page_chunk_map[page_num]
                if sec_clean:
                    for chunk in chunks_for_page:
                        c_sec = chunk.get("section", "")
                        if sec_clean.lower() in c_sec.lower() or c_sec.lower() in sec_clean.lower():
                            matched_snippet = chunk.get("snippet", "")
                            if not matched_section:
                                matched_section = c_sec
                            break
                if not matched_snippet and chunks_for_page:
                    matched_snippet = chunks_for_page[0].get("snippet", "")
                    if not matched_section and chunks_for_page[0].get("section"):
                        matched_section = chunks_for_page[0].get("section")

            label = f"Page {page_num}: {sec_clean}" if sec_clean else f"Page {page_num}"
            key = (page_num, sec_clean)
            if key not in seen_keys:
                seen_keys.add(key)
                source_labels.append(label)
                source_details.append({
                    "label": label,
                    "page": page_num,
                    "section": matched_section or None,
                    "snippet": matched_snippet or None,
                    "type": "pdf"
                })

        # 2. Look for Report sections in final answer
        section_patterns = [
            ("Methodology Evaluation", "Methodology Evaluation"),
            ("Methodological Evaluation", "Methodology Evaluation"),
            ("Evidence Quality", "Evidence Quality"),
            ("Results Scrutiny", "Results Scrutiny"),
            ("Critical Review", "Critical Review"),
            ("Executive Summary", "Executive Summary"),
            ("Gap Analysis", "Gap Analysis"),
            ("Novelty Assessment", "Novelty Assessment"),
            ("Impact Assessment", "Impact Assessment"),
            ("Overall Verdict", "Overall Verdict")
        ]
        for pattern, label in section_patterns:
            if pattern.lower() in answer_text.lower():
                key = (label, "report")
                if key not in seen_keys:
                    seen_keys.add(key)
                    source_labels.append(label)
                    source_details.append({
                        "label": label,
                        "section": label,
                        "type": "report"
                    })
        
        # Sort sources: pages first (by page number), then report sections
        def sort_key(s: Dict[str, Any]):
            if s.get("type") == "pdf" and s.get("page"):
                return (0, s["page"], s.get("section") or "")
            return (1, 0, s.get("label") or "")
            
        source_details.sort(key=sort_key)
        sorted_labels = [s["label"] for s in source_details]
        
        if not sorted_labels:
            sorted_labels = ["Paper Content"]
            source_details = [{
                "label": "Paper Content",
                "type": "unknown"
            }]

        return sorted_labels, source_details
