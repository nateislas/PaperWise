from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

RUBRIC_VERSION = "2026.09"

class Level(str, Enum):
    STRONG = "strong"        # holds up on this axis
    ADEQUATE = "adequate"    # fine, unremarkable
    WEAK = "weak"            # a real, nameable concern
    FAILING = "failing"      # undermines the paper's central claim
    UNCLEAR = "unclear"      # the paper does not give enough to judge

class Severity(str, Enum):
    BLOCKING = "blocking"
    MATERIAL = "material"
    MINOR = "minor"

class Category(str, Enum):
    METHODOLOGY = "methodology"
    STATISTICS = "statistics"
    DATA = "data"
    BASELINES = "baselines"
    REPRODUCIBILITY = "reproducibility"
    OVERCLAIMING = "overclaiming"
    SCOPE = "scope"
    ETHICS = "ethics"

class Evidence(BaseModel):
    page: int
    section: Optional[str] = None
    quote: Optional[str] = Field(None, max_length=280)

class AxisScore(BaseModel):
    level: Level
    one_line: str = Field(..., max_length=120)
    detail: Optional[str] = Field(None, max_length=900)
    confidence: float = Field(..., ge=0, le=1)
    evidence: List[Evidence] = Field(default_factory=list, max_length=4)

class Concern(BaseModel):
    severity: Severity
    category: Category
    title: str = Field(..., max_length=80)
    detail: Optional[str] = Field(None, max_length=600)
    affects_axis: Optional[str] = None
    evidence: List[Evidence] = Field(default_factory=list, max_length=3)
    rank: int = 0

class AnalysisV2(BaseModel):
    rubric_version: Literal["2026.09"] = RUBRIC_VERSION
    bottom_line: str = Field(..., max_length=420)
    field: str
    subfield: Optional[str] = None
    field_confidence: float = Field(..., ge=0, le=1)

    methodology: AxisScore
    evidence: AxisScore
    reproducibility: AxisScore
    novelty: AxisScore

    concerns: List[Concern] = Field(default_factory=list, max_length=12)

    what_they_did: str
    what_they_found: str
    why_it_matters: str
    where_this_could_go: str
    full_summary: str
    confidence: float = Field(..., ge=0, le=1)

    @property
    def executive_summary(self) -> str:
        return self.full_summary

    def to_comprehensive_dict(self) -> dict:
        """Serializes the AnalysisV2 instance, enriched with legacy section keys for backward compatibility."""
        data = self.model_dump()
        data["executive_summary"] = self.full_summary
        data["methodological_evaluation"] = {
            "rigor_assessment": self.methodology.level.value,
            "approach_strength": self.what_they_did,
            "reproducibility": self.reproducibility.level.value,
            "potential_issues": [f"{c.title}: {c.detail or ''}" for c in self.concerns if c.category == Category.METHODOLOGY] or [c.title for c in self.concerns[:3]],
        }
        data["evidence_quality"] = {
            "overall_quality": self.evidence.level.value,
            "empirical_support": self.what_they_found,
            "assessment": self.evidence.one_line,
        }
        data["novelty_assessment"] = {
            "novelty_score": self.novelty.level.value,
            "key_innovation": self.why_it_matters,
            "justification": self.novelty.one_line,
        }
        data["gap_analysis"] = {
            "problem_statement": self.where_this_could_go,
        }
        data["critical_review"] = {
            "major_concerns": [f"{c.title}: {c.detail or ''}" for c in self.concerns],
        }
        return data

SEVERITY_WEIGHT = {"blocking": 0, "material": 1, "minor": 2}
CATEGORY_TIEBREAK = [
    "methodology",
    "statistics",
    "data",
    "baselines",
    "reproducibility",
    "overclaiming",
    "scope",
    "ethics",
]

def rank_concerns(concerns: List[Concern]) -> List[Concern]:
    def key(c: Concern):
        return (
            SEVERITY_WEIGHT.get(c.severity.value, 3),
            0 if c.evidence else 1,
            CATEGORY_TIEBREAK.index(c.category.value)
            if c.category.value in CATEGORY_TIEBREAK
            else 99,
            c.title.lower(),
        )

    ranked = sorted(concerns, key=key)
    for i, c in enumerate(ranked):
        c.rank = i
    return ranked

def reconcile(a: AnalysisV2) -> AnalysisV2:
    """Ensure consistency between axis failing levels and blocking concerns."""
    blocking_axes = {c.affects_axis for c in a.concerns if c.severity == Severity.BLOCKING}
    for axis_name in ("methodology", "evidence", "reproducibility", "novelty"):
        axis = getattr(a, axis_name)
        if axis.level == Level.FAILING and axis_name not in blocking_axes:
            axis.level = Level.WEAK
        if axis_name in blocking_axes and axis.level in (Level.STRONG, Level.ADEQUATE):
            axis.level = Level.WEAK
    return a
