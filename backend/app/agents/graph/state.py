from typing import List, Dict, Any, Optional, Annotated, Union
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
import operator

# --- Pydantic Models for Structured Output ---

class NoveltyAssessment(BaseModel):
    """Assessment of a paper's novelty and technical contribution."""
    key_innovation: str = Field(description="What is genuinely new here? Be specific about the technical contribution")
    incremental_advances: List[str] = Field(default_factory=list, description="List of smaller improvements or refinements")
    novelty_score: str = Field(description="high/medium/low - how significant is this contribution?")
    justification: str = Field(description="Why this score? What makes this work stand out or fall short?")

class GapAnalysis(BaseModel):
    """Analysis of the research gaps addressed by the paper."""
    problem_statement: str = Field(description="What specific gap or limitation does this work address?")
    motivation: str = Field(description="Why is this gap important to fill?")
    scope: str = Field(description="What aspects of the problem are NOT addressed?")

class MethodologicalEvaluation(BaseModel):
    """Evaluation of the research methodology and experimental design."""
    approach_strength: str = Field(description="What are the strongest aspects of the methodology?")
    potential_issues: List[str] = Field(default_factory=list, description="List of methodological concerns or limitations")
    rigor_assessment: str = Field(description="high/medium/low - how well-controlled and validated is this work?")
    reproducibility: str = Field(description="What would be needed to reproduce this work? What's missing?")

class EvidenceQuality(BaseModel):
    """Assessment of the empirical support and results quality."""
    empirical_support: str = Field(description="How strong is the evidence for the main claims?")
    key_results: List[str] = Field(default_factory=list, description="Most important empirical findings with specific metrics")
    statistical_significance: str = Field(description="Are the results statistically sound? Any concerns?")
    baseline_comparison: str = Field(description="How do the baselines compare? Are they appropriate?")

class ImpactAssessment(BaseModel):
    """Evaluation of the paper's contribution to the field and practical significance."""
    theoretical_contribution: str = Field(description="What does this add to our theoretical understanding?")
    practical_significance: str = Field(description="What are the real-world implications?")
    field_impact: str = Field(description="How might this influence future research in this area?")

class ResearchOpportunities(BaseModel):
    """Identification of future research directions and open questions."""
    immediate_extensions: List[str] = Field(default_factory=list, description="Logical next steps that build directly on this work")
    broader_directions: List[str] = Field(default_factory=list, description="Research directions this enables in related areas")
    open_questions: List[str] = Field(default_factory=list, description="Important questions this work raises but doesn't answer")

class ImplementationGuide(BaseModel):
    """Guide for researchers looking to implement or extend the work."""
    complexity: str = Field(description="high/medium/low - how difficult would this be to implement?")
    requirements: List[str] = Field(default_factory=list, description="Key resources, data, or expertise needed")
    missing_details: List[str] = Field(default_factory=list, description="What important implementation details are unclear or missing")
    estimated_effort: str = Field(description="Rough estimate: weeks/months/years for a skilled researcher")

class CriticalReview(BaseModel):
    """Critical synthesis of the paper's strengths and weaknesses."""
    major_strengths: List[str] = Field(default_factory=list, description="Most compelling aspects of this work")
    major_concerns: List[str] = Field(default_factory=list, description="Most significant limitations or potential issues")
    alternative_approaches: List[str] = Field(default_factory=list, description="Other ways this problem could be approached")
    robustness: str = Field(description="How robust are the conclusions? What could invalidate them?")

class AnalysisReport(BaseModel):
    """Comprehensive analysis report synthesizing all aspects of a research paper."""
    executive_summary: str = Field(description="2-3 paragraphs: What problem does this solve? What's the key innovation? What are the main results?")
    novelty_assessment: NoveltyAssessment
    gap_analysis: GapAnalysis
    methodological_evaluation: MethodologicalEvaluation
    evidence_quality: EvidenceQuality
    impact_assessment: ImpactAssessment
    research_opportunities: ResearchOpportunities
    implementation_guide: ImplementationGuide
    critical_review: CriticalReview

class FieldClassification(BaseModel):
    """Classification of the paper's academic domain and relevant venues."""
    field: str = Field(description="Primary domain of the paper")
    subfield: str = Field(description="Specific sub-domain")
    conferences: List[str] = Field(description="Relevant academic conferences (top 3)")
    confidence: float = Field(ge=0, le=1)

# --- Graph State ---

class PaperAnalysisState(TypedDict):
    """
    Represents the state of the paper analysis graph.
    
    This TypedDict tracks the input data, intermediate processing results from various
    specialized agents, and the final synthesized report. It also manages status
    updates and error accumulation across the graph's execution.
    """
    # Input
    file_path: str
    user_query: Optional[str]
    
    # Internal Processing State
    parsed_content: Dict[str, Any]
    documents: List[Any]  # List[Document]
    detected_field: str
    field_info: FieldClassification
    
    # Agent Outputs (Accumulated)
    methodology_analysis: str
    results_analysis: str
    context_analysis: str
    
    # Final Output
    final_report: AnalysisReport
    
    # Control/Status
    status_updates: Annotated[List[Dict[str, Any]], operator.add]
    errors: Annotated[List[str], operator.add]
