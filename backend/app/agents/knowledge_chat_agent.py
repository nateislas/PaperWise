import logging
import os
import re
import json
from typing import Dict, List, Any, Optional

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from app.config import settings
from app.analysis_manager import analysis_manager

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are PaperWise's Knowledge Assistant, an expert scholar investigating the research paper: "{paper_title}".

You have access to 4 specialized local research tools:
1. `retrieve_paper_chunks`: Search relevant text passages across the paper with exact page numbers.
2. `lookup_analysis_report`: Query our pre-computed peer review evaluation (methodology, evidence quality, gaps, novelty, critical review, verdict).
3. `lookup_tables_and_figures`: Query extracted Markdown tables and figure diagrams with numerical metrics.
4. `get_paper_metadata`: View paper title, authors, domain, publication venue, and citation metrics.

Guidelines:
- Ground your answers in evidence retrieved from the paper and our analysis report.
- When referencing specific text, claims, or data from the paper, cite the exact page using `[Page X]` format (e.g. `[Page 4]`).
- When referencing reviewer critiques or debate verdicts, cite the relevant section (e.g. `[Methodological Evaluation]` or `[Critical Review]`).
- If the user provides specific context from a highlighted passage, address that context directly while leveraging tools for broader connections.
- Be concise, scholarly, objective, and clear. If a detail is missing or not covered in the paper, state that honestly.
"""

class KnowledgeChatAgent:
    """
    Expert Agent for exploring and querying a research paper using a LangGraph ReAct Deep Agent.
    Operates 100% locally with Google Gemini 2.5 Flash and multi-source research tools.
    """
    
    def __init__(self, analysis_id: str):
        self.analysis_id = analysis_id
        self.llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.gemini_temperature,
            timeout=settings.request_timeout
        )

    def _load_data(self):
        parsed_content = analysis_manager.get_parsed_content(self.analysis_id) or {}
        comprehensive = analysis_manager.get_analysis_result(self.analysis_id, "comprehensive") or {}
        metadata = analysis_manager.get_analysis_metadata(self.analysis_id) or {}
        return parsed_content, comprehensive, metadata

    def _build_tools(self, parsed_content: Dict[str, Any], comprehensive: Dict[str, Any], metadata: Dict[str, Any]):
        chunks = parsed_content.get("chunks", [])
        tables = parsed_content.get("tables", [])
        figures = parsed_content.get("figures", [])
        
        # Normalize chunks for search
        normalized_chunks = []
        for i, c in enumerate(chunks):
            if isinstance(c, dict):
                text = c.get("text") or c.get("content") or ""
                meta = c.get("metadata", {})
                page = meta.get("page") or c.get("page") or 1
            elif hasattr(c, "page_content"):
                text = c.page_content
                meta = getattr(c, "metadata", {})
                page = meta.get("page", 1)
            else:
                text = str(c)
                page = 1
            normalized_chunks.append({"text": text, "page": int(page), "id": i})

        @tool
        def retrieve_paper_chunks(query: str, page_number: Optional[int] = None) -> str:
            """Search for relevant text passages in the research paper.
            Optionally filter by exact page_number (1-indexed).
            Use this to look up specific claims, experimental setup, proofs, equations, or discussions."""
            if not normalized_chunks:
                # Fallback to text_content if chunks are empty
                raw_text = parsed_content.get("text_content", "")
                if raw_text:
                    return f"[Full Text Excerpt]\n{raw_text[:2500]}..."
                return "No text chunks available for this paper."
            
            tokens = set(re.findall(r'\w{3,}', query.lower()))
            scored = []
            for c in normalized_chunks:
                if page_number is not None and c["page"] != int(page_number):
                    continue
                c_text = c["text"]
                if not c_text:
                    continue
                score = sum(1 for t in tokens if t in c_text.lower())
                if score > 0 or not tokens:
                    scored.append((score, c["page"], c_text))
            
            scored.sort(key=lambda x: x[0], reverse=True)
            top_matches = scored[:5] if scored else normalized_chunks[:3]
            
            output = []
            for score, page, text in top_matches:
                output.append(f"--- [Page {page}] ---\n{text.strip()}")
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

    async def chat(self, message: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Process a chat message using the LangGraph ReAct Deep Agent.
        
        Args:
            message: Current user message.
            history: Previous conversation history.
            
        Returns:
            Dict[str, Any]: {"answer": str, "sources": List[str]}
        """
        try:
            parsed_content, comprehensive, metadata = self._load_data()
            paper_title = metadata.get("paper_info", {}).get("title", "Research Paper")
            
            tools = self._build_tools(parsed_content, comprehensive, metadata)
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(paper_title=paper_title)
            
            # Create LangGraph ReAct Agent
            agent = create_react_agent(self.llm, tools, prompt=system_prompt)
            
            # Assemble message history
            lang_messages = []
            for h in history[-8:]:
                role = h.get("role")
                content = h.get("content", "")
                if role == "user":
                    lang_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    lang_messages.append(AIMessage(content=content))
            
            lang_messages.append(HumanMessage(content=message))
            
            logger.info(f"🤖 Invoking LangGraph Deep Chat Agent for paper {self.analysis_id}")
            result = await agent.ainvoke({"messages": lang_messages})
            
            # Retrieve final assistant message
            response_messages = result.get("messages", [])
            final_content = "I could not formulate an answer."
            for m in reversed(response_messages):
                if isinstance(m, AIMessage) and m.content:
                    final_content = m.content if isinstance(m.content, str) else str(m.content)
                    break

            # Extract citations from tool outputs and answer text
            sources = self._extract_sources(response_messages, final_content)
            
            return {
                "answer": final_content,
                "sources": sources
            }
            
        except Exception as e:
            logger.error(f"Error in LangGraph KnowledgeChatAgent: {e}", exc_info=True)
            raise e

    def _extract_sources(self, messages: List[Any], answer_text: str) -> List[str]:
        """Extract exact page citations and analysis sections for UI badges."""
        sources = set()
        
        # 1. Look for [Page X] or Page X in final answer
        page_matches = re.findall(r'\[?Page\s+(\d+)\]?', answer_text, re.IGNORECASE)
        for p in page_matches:
            sources.add(f"Page {p}")
            
        # 2. Look for Report sections in final answer
        section_patterns = [
            ("Methodology", "Methodology Evaluation"),
            ("Methodological Evaluation", "Methodology Evaluation"),
            ("Evidence Quality", "Evidence Quality"),
            ("Results Scrutiny", "Results Scrutiny"),
            ("Critical Review", "Critical Review"),
            ("Executive Summary", "Executive Summary"),
            ("Gap Analysis", "Gap Analysis"),
            ("Novelty Assessment", "Novelty Assessment"),
            ("Overall Verdict", "Overall Verdict")
        ]
        for pattern, label in section_patterns:
            if pattern.lower() in answer_text.lower():
                sources.add(label)
                
        # 3. If tools were called with specific pages or sections, include them
        for m in messages:
            # Check ToolMessages for returned Page headers
            content = getattr(m, "content", "")
            if isinstance(content, str):
                tool_pages = re.findall(r'\[Page\s+(\d+)\]', content, re.IGNORECASE)
                for p in tool_pages[:3]: # Cap to top 3 referenced pages
                    sources.add(f"Page {p}")
        
        # Natural sorting: pages first, then report sections
        def sort_key(s: str):
            if s.startswith("Page "):
                try:
                    return (0, int(s.split(" ")[1]))
                except Exception:
                    return (0, 999)
            return (1, s)
            
        sorted_sources = sorted(list(sources), key=sort_key)
        return sorted_sources if sorted_sources else ["Paper Content"]
