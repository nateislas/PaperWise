import logging
import time
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.config import settings
from app.agents.graph.state import PaperAnalysisState

logger = logging.getLogger(__name__)

async def enrich_context_node(state: PaperAnalysisState) -> Dict[str, Any]:
    """
    Post-synthesis enrichment: retrieves citation metrics, related academic papers,
    and external web context via Semantic Scholar and Exa AI.
    
    Operates non-blockingly and fails gracefully if external APIs are unavailable.
    
    Args:
        state (PaperAnalysisState): The current graph state.
        
    Returns:
        Dict[str, Any]: Enrichment payload containing citations, related papers, and web context.
    """
    logger.info("🌐 Node: External Context Enrichment")
    start_time = time.time()
    
    enrichment: Dict[str, Any] = {
        "citation_count": None,
        "influential_citation_count": None,
        "semantic_scholar_url": None,
        "related_papers": [],
        "web_context": []
    }
    
    # Resolve paper title
    metadata = state.get("parsed_content", {}).get("metadata", {}) if isinstance(state.get("parsed_content"), dict) else {}
    paper_title = metadata.get("title", "")
    
    # Fallback to extracting title from first document chunk if title is generic and enrichment is enabled
    if settings.enable_external_enrichment and (not paper_title or paper_title.lower() in ("unknown", "")) and state.get("documents"):
        first_content = state["documents"][0].page_content.strip()
        # Take first line as approximate title candidate
        lines = [ln.strip() for ln in first_content.splitlines() if ln.strip()]
        if lines:
            paper_title = lines[0][:200]

    # 1. Semantic Scholar Lookup (runs in thread pool)
    async def fetch_semantic_scholar():
        if not settings.enable_external_enrichment or not paper_title or paper_title.lower() in ("unknown", ""):
            return
            
        def _sync_s2():
            try:
                from semanticscholar import SemanticScholar
                sch = SemanticScholar(api_key=settings.semantic_scholar_api_key) if settings.semantic_scholar_api_key else SemanticScholar()
                results = sch.search_paper(paper_title, limit=1)
                
                if results and results.items:
                    paper = results.items[0]
                    enrichment["citation_count"] = paper.citationCount
                    enrichment["influential_citation_count"] = getattr(paper, "influentialCitationCount", None)
                    enrichment["semantic_scholar_url"] = getattr(paper, "url", f"https://semanticscholar.org/paper/{paper.paperId}")
                    
                    try:
                        recommended = sch.get_recommended_papers(paper.paperId, limit=5)
                        if recommended:
                            enrichment["related_papers"] = [
                                {
                                    "title": getattr(r, "title", "Unknown"),
                                    "year": getattr(r, "year", None),
                                    "citations": getattr(r, "citationCount", 0),
                                    "url": getattr(r, "url", None)
                                }
                                for r in recommended if getattr(r, "title", None)
                            ]
                    except Exception as rec_err:
                        logger.debug(f"Semantic Scholar recommendations skipped: {rec_err}")
            except Exception as s2_err:
                logger.warning(f"Semantic Scholar lookup failed: {s2_err}")
                
        await asyncio.to_thread(_sync_s2)

    # 2. Exa AI Lookup (runs in thread pool)
    async def fetch_exa():
        if not settings.enable_external_enrichment or not settings.exa_api_key or not paper_title or paper_title.lower() in ("unknown", ""):
            return
            
        def _sync_exa():
            try:
                from exa_py import Exa
                exa = Exa(api_key=settings.exa_api_key)
                search_query = f"research paper: {paper_title}"
                results = exa.search_and_contents(
                    search_query,
                    type="neural",
                    num_results=5,
                    highlights=True,
                    use_autoprompt=True
                )
                if results and hasattr(results, "results"):
                    enrichment["web_context"] = [
                        {
                            "title": getattr(r, "title", "Web Source"),
                            "url": getattr(r, "url", ""),
                            "highlights": getattr(r, "highlights", [])[:2] if getattr(r, "highlights", None) else []
                        }
                        for r in results.results if getattr(r, "title", None)
                    ]
            except Exception as exa_err:
                logger.warning(f"Exa search lookup failed: {exa_err}")
                
        await asyncio.to_thread(_sync_exa)

    # Run lookups concurrently with a strict 5-second timeout to protect response latency
    try:
        await asyncio.wait_for(
            asyncio.gather(fetch_semantic_scholar(), fetch_exa(), return_exceptions=True),
            timeout=5.0
        )
    except asyncio.TimeoutError:
        logger.warning("External enrichment timed out after 5.0s, proceeding with available data.")
    except Exception as e:
        logger.warning(f"Error during enrichment gathering: {e}")

    elapsed = time.time() - start_time
    sources_found = (1 if enrichment.get("citation_count") is not None else 0) + len(enrichment.get("related_papers", [])) + len(enrichment.get("web_context", []))

    return {
        "enrichment_data": enrichment,
        "status_updates": [{
            "type": "status",
            "message": f"External literature enrichment complete ({sources_found} external references identified).",
            "progress": 98
        }],
        "node_provenance": [{
            "node": "enrich_context",
            "elapsed_seconds": elapsed,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "success",
            "metadata": {
                "sources_found": sources_found,
                "citation_count": enrichment.get("citation_count"),
                "has_exa": bool(settings.exa_api_key)
            }
        }]
    }
