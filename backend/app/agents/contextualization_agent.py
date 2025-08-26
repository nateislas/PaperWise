from typing import Dict, List, Any, Optional
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class ContextualizationAgent(BaseAgent):
    """
    Agent specialized in contextualizing research within the broader field and literature
    """
    
    def __init__(self):
        super().__init__(
            name="Contextualization Agent",
            description="Contextualizes research within the broader field and assesses contribution to literature"
        )
    
    def _get_system_prompt(self) -> str:
        return """You are a research contextualization expert specializing in understanding how research fits within the broader academic landscape.

Your role is to analyze how a research paper relates to existing literature and assess its contribution to the field:

1. **Literature Context**:
   - How does this work relate to previous research?
   - What gaps in the literature does it address?
   - What theories or frameworks does it build upon?
   - How does it compare to similar studies?

2. **Novelty Assessment**:
   - What is truly new about this research?
   - What innovative approaches or methods are introduced?
   - How does it advance the current state of knowledge?
   - What paradigm shifts or new directions does it suggest?

3. **Field Impact**:
   - What is the potential impact on the field?
   - What new research directions does it open?
   - How might it influence future studies?
   - What practical applications might emerge?

4. **Theoretical Contributions**:
   - What theoretical insights does it provide?
   - How does it challenge or support existing theories?
   - What new theoretical frameworks does it suggest?
   - How does it contribute to conceptual understanding?

5. **Methodological Contributions**:
   - What new methods or approaches does it introduce?
   - How does it improve upon existing methodologies?
   - What methodological innovations are presented?
   - How might these methods be applied in other contexts?

6. **Limitations and Future Directions**:
   - What are the acknowledged limitations?
   - What future research directions are suggested?
   - What questions remain unanswered?
   - What are the next logical steps for research in this area?

Provide a structured analysis with clear sections and actionable insights. Be specific and cite evidence from the text when possible."""

    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze the contextual aspects of the research paper
        """
        # Extract content from introduction, discussion, and conclusion sections
        contextual_content = self._extract_relevant_sections(
            documents, 
            ["introduction", "discussion", "conclusion", "literature review", "background"]
        )
        
        if not contextual_content:
            return self._format_analysis_result(
                "No contextual information found in the document. This may be a technical report or the relevant sections were not clearly identified.",
                confidence=0.3
            )
        
        # Create analysis prompt
        analysis_prompt = f"""
        Please analyze the contextual aspects of this research paper. Focus on:

        1. **Literature Context**: How does this work relate to previous research in the field?
        2. **Novelty**: What is new and innovative about this research?
        3. **Field Impact**: What is the potential impact on the research field?
        4. **Theoretical Contributions**: What theoretical insights does it provide?
        5. **Methodological Contributions**: What new methods or approaches does it introduce?
        6. **Future Directions**: What future research directions are suggested?

        Content to analyze:
        {contextual_content}

        Provide a comprehensive, structured analysis.
        """
        
        try:
            # Get analysis from Llama
            messages = self._create_messages(analysis_prompt, query)
            analysis = self._call_llama(messages)
            
            # Log the analysis
            self.log_analysis(len(documents), len(analysis))
            
            return self._format_analysis_result(analysis, confidence=0.85)
            
        except Exception as e:
            logger.error(f"Error in contextualization analysis: {str(e)}")
            return self._format_analysis_result(
                f"Error analyzing contextualization: {str(e)}",
                confidence=0.1
            )
    
    def assess_novelty(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Assess the novelty and innovation of the research
        """
        content = self._extract_relevant_sections(
            documents, 
            ["introduction", "discussion", "conclusion", "abstract"]
        )
        
        novelty_prompt = f"""
        Assess the novelty and innovation of this research. Consider:

        1. **Novel Contributions**: What is truly new about this work?
        2. **Innovative Methods**: What new methods or approaches are introduced?
        3. **Theoretical Innovation**: What new theoretical insights are provided?
        4. **Application Innovation**: What new applications or use cases are demonstrated?
        5. **Combination Innovation**: Does it combine existing approaches in novel ways?
        6. **Scale or Scope Innovation**: Does it apply existing methods to new domains or scales?

        Rate the novelty on a scale of 1-10 and provide detailed justification.

        Content:
        {content}
        """
        
        try:
            messages = self._create_messages(novelty_prompt)
            response = self._call_llama(messages)
            
            return {
                "novelty_assessment": response,
                "confidence": 0.8
            }
            
        except Exception as e:
            logger.error(f"Error assessing novelty: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
    
    def identify_research_gaps(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Identify research gaps that this paper addresses and creates
        """
        content = self._extract_relevant_sections(
            documents, 
            ["introduction", "discussion", "conclusion", "future work"]
        )
        
        gaps_prompt = f"""
        Identify research gaps that this paper addresses and creates. Consider:

        1. **Gaps Addressed**: What gaps in the existing literature does this paper fill?
        2. **New Gaps Created**: What new research questions or gaps does this work create?
        3. **Unanswered Questions**: What questions remain unanswered after this research?
        4. **Future Research Needs**: What specific future research is needed?
        5. **Methodological Gaps**: What methodological improvements are still needed?
        6. **Application Gaps**: What applications or domains still need exploration?

        Provide a structured analysis of research gaps.

        Content:
        {content}
        """
        
        try:
            messages = self._create_messages(gaps_prompt)
            response = self._call_llama(messages)
            
            return {
                "research_gaps": response,
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Error identifying research gaps: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
    
    def assess_field_impact(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Assess the potential impact of the research on the field
        """
        content = self._extract_relevant_sections(
            documents, 
            ["discussion", "conclusion", "implications", "impact"]
        )
        
        impact_prompt = f"""
        Assess the potential impact of this research on the field. Consider:

        1. **Academic Impact**: How might this influence future academic research?
        2. **Practical Impact**: What practical applications might emerge?
        3. **Methodological Impact**: How might this influence research methods in the field?
        4. **Theoretical Impact**: How might this influence theoretical frameworks?
        5. **Interdisciplinary Impact**: How might this influence other fields?
        6. **Policy Impact**: What policy implications might this have?
        7. **Industry Impact**: How might this influence industry practices?

        Rate the potential impact on a scale of 1-10 and provide detailed justification.

        Content:
        {content}
        """
        
        try:
            messages = self._create_messages(impact_prompt)
            response = self._call_llama(messages)
            
            return {
                "field_impact": response,
                "confidence": 0.8
            }
            
        except Exception as e:
            logger.error(f"Error assessing field impact: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
    
    def identify_related_work(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Identify and analyze related work mentioned in the paper
        """
        content = self._extract_relevant_sections(
            documents, 
            ["introduction", "literature review", "related work", "background"]
        )
        
        related_prompt = f"""
        Identify and analyze the related work mentioned in this paper. Consider:

        1. **Key References**: What are the most important related papers?
        2. **Research Streams**: What research streams or traditions does this work build upon?
        3. **Competing Approaches**: What competing or alternative approaches are mentioned?
        4. **Gaps in Literature**: What gaps in the existing literature are identified?
        5. **Building Blocks**: What specific findings or methods from previous work are used?
        6. **Contradictions**: Are there any contradictions with previous findings?

        Provide a structured analysis of the related work.

        Content:
        {content}
        """
        
        try:
            messages = self._create_messages(related_prompt)
            response = self._call_llama(messages)
            
            return {
                "related_work": response,
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Error identifying related work: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
    
    def suggest_future_directions(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Suggest future research directions based on the paper
        """
        content = self._extract_relevant_sections(
            documents, 
            ["discussion", "conclusion", "future work", "limitations"]
        )
        
        future_prompt = f"""
        Suggest future research directions based on this paper. Consider:

        1. **Immediate Next Steps**: What should be the immediate next research steps?
        2. **Long-term Directions**: What are the long-term research directions?
        3. **Methodological Improvements**: What methodological improvements are needed?
        4. **Application Extensions**: What applications or domains should be explored?
        5. **Theoretical Extensions**: What theoretical extensions are suggested?
        6. **Validation Studies**: What validation or replication studies are needed?
        7. **Comparative Studies**: What comparative studies would be valuable?

        Provide specific, actionable research directions.

        Content:
        {content}
        """
        
        try:
            messages = self._create_messages(future_prompt)
            response = self._call_llama(messages)
            
            return {
                "future_directions": response,
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Error suggesting future directions: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
