import logging
from typing import Any, Dict, List, Optional

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class FieldClassifierAgent(BaseAgent):
    """
    Lightweight field classifier that labels the paper's primary domain.

    Output format:
    {
      "field": str,              # e.g., "ml_dl", "systems", "bio", "math", "generic"
      "confidence": float,       # 0..1
      "rationale": str           # short explanation
    }
    """

    def __init__(self) -> None:
        super().__init__("FieldClassifier", "Classifies paper by academic field")

    def _get_system_prompt(self) -> str:
        return (
            "You are a research community classifier for academic papers. "
            "Identify the primary research area, specific subfield, and key conferences/journals. "
            "Return strict JSON with keys: field, subfield, conferences, confidence (0..1), rationale. "
            "Field options: ml_dl, systems, bio, medicine, hci, math, physics, chemistry, economics, social_science, generic. "
            "Be specific about subfields (e.g., 'computer_vision', 'nlp', 'robotics' for ml_dl)."
        )

    def analyze(self, documents: List[Any], query: Optional[str] = None) -> Dict[str, Any]:
        # Not used in synchronous mode for now
        raise NotImplementedError

    async def classify(self, text: str) -> Dict[str, Any]:
        sample_cues = (
            "Cues: ML/DL keywords include: architecture, transformer, CNN, attention, loss function, training, GPU, dataset; "
            "Systems: operating system, distributed, throughput, latency, cluster; "
            "Bio/Med: gene, protein, clinical trial, patient, assay; "
            "Math: theorem, proof, lemma; Physics: quantum, particle, field theory; HCI: user study, usability; Economics: market, equilibrium; Social science: survey, ethnography."
        )
        prompt = (
            f"Classify the following paper text. {sample_cues}\n\n"
            f"TEXT (truncate if long):\n{text[:8000]}\n\n"
            "Return JSON only, no prose. Example: {\"field\": \"ml_dl\", \"subfield\": \"nlp\", \"conferences\": [\"ACL\", \"EMNLP\", \"ICLR\"], \"confidence\": 0.78, \"rationale\": \"mentions transformer, pretraining, benchmarks\"}"
        )

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]

        try:
            content = ""
            async for chunk in self._call_llama_stream(messages):
                content += chunk

            # Best-effort JSON parsing; fallback to generic
            import json

            try:
                # Strip fences if model added them
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1]
                    if cleaned.endswith("```"):
                        cleaned = cleaned[:-3]
                data = json.loads(cleaned)
            except Exception:
                logger.warning("FieldClassifier: failed to parse JSON, defaulting to generic")
                data = {"field": "generic", "confidence": 0.5, "rationale": "fallback"}

            field = str(data.get("field", "generic")).lower().strip()
            subfield = str(data.get("subfield", "")).strip()
            conferences = data.get("conferences", [])
            if isinstance(conferences, str):
                conferences = [conferences]
            elif not isinstance(conferences, list):
                conferences = []
            confidence = float(data.get("confidence", 0.5))
            rationale = str(data.get("rationale", "")).strip()

            if field not in {
                "ml_dl",
                "systems",
                "bio",
                "medicine",
                "hci",
                "math",
                "physics",
                "chemistry",
                "economics",
                "social_science",
                "generic",
            }:
                field = "generic"

            return {
                "field": field, 
                "subfield": subfield, 
                "conferences": conferences,
                "confidence": confidence, 
                "rationale": rationale
            }
        except Exception as e:
            logger.error(f"Field classification failed: {e}")
            return {
                "field": "generic", 
                "subfield": "", 
                "conferences": [],
                "confidence": 0.0, 
                "rationale": "error"
            }


