import json
import logging
from typing import Any, Dict, List, Optional

from langchain.schema import Document

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class StructuredSectionExtractor(BaseAgent):
    """
    Generic extractor that produces structured JSON for a given section spec.
    The spec contains cues, schema, guidance, etc. This avoids domain-specific agents.
    """

    def __init__(self) -> None:
        super().__init__("SectionExtractor", "Extracts structured sections from papers")

    def _get_system_prompt(self) -> str:
        return (
            "You are a research analyst extracting specific, evidence-grounded sections from papers. "
            "Only include information that is explicitly stated or strongly implied in the provided evidence. "
            "For each claim or fact, indicate your confidence level. "
            "If information is missing or unclear, use null/empty values rather than guessing. "
            "Return strict JSON that conforms to the requested schema."
        )

    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        # Not used directly; call extract_section instead
        raise NotImplementedError

    def _collect_evidence(self, documents: List[Document], cues: List[str], max_chars: int = 12000) -> str:
        cues_lower = [c.lower() for c in cues]
        selected: List[str] = []
        for doc in documents:
            text_lower = doc.page_content.lower()
            if any(cue in text_lower for cue in cues_lower):
                selected.append(doc.page_content)
            if sum(len(s) for s in selected) >= max_chars:
                break
        # Fallback to leading content if nothing matched
        if not selected and documents:
            selected.append(documents[0].page_content[:max_chars])
        return "\n\n".join(selected)[:max_chars]

    async def extract_section(self, documents: List[Document], spec: Dict[str, Any]) -> Dict[str, Any]:
        cues: List[str] = spec.get("cues", [])
        schema: Dict[str, Any] = spec.get("schema", {})
        guidance: str = spec.get("guidance", "")

        evidence = self._collect_evidence(documents, cues)

        schema_text = json.dumps(schema)
        user_prompt = (
            f"You are to extract the section '{spec.get('title')}' (key={spec.get('key')}).\n"
            f"Follow guidance: {guidance}\n\n"
            f"Output must be valid JSON matching this schema descriptor (types only): {schema_text}.\n"
            f"IMPORTANT: Only include information explicitly stated or strongly implied in the evidence. "
            f"If a field is unknown, unclear, or not mentioned, use null, empty string, or empty array. "
            f"Do not speculate or invent details.\n\n"
            f"EVIDENCE:\n{evidence}\n\nReturn JSON only."
        )

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        content = ""
        async for chunk in self._call_llama_stream(messages):
            content += chunk

        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
            data = json.loads(cleaned)
            return {"key": spec.get("key"), "title": spec.get("title"), "data": data}
        except Exception:
            logger.warning("SectionExtractor: JSON parse failed; returning empty data for %s", spec.get("key"))
            return {"key": spec.get("key"), "title": spec.get("title"), "data": None}


