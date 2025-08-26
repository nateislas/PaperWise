from typing import Dict, List, Any, Optional
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class MethodologyAgent(BaseAgent):
    """
    Agent specialized in analyzing research methodology, experimental design, and methods
    """
    
    def __init__(self):
        super().__init__(
            name="Methodology Agent",
            description="Analyzes experimental design, methodology, and research approach"
        )
    
    def _get_system_prompt(self) -> str:
        return """You are a research methodology expert specializing in analyzing experimental design and research methods.

Your role is to critically evaluate the methodology section of research papers and provide insights on:

1. **Experimental Design**:
   - Study type (observational, experimental, quasi-experimental, etc.)
   - Sample size and power analysis
   - Randomization and blinding procedures
   - Control groups and experimental conditions

2. **Data Collection Methods**:
   - Instruments and tools used
   - Data collection procedures
   - Quality control measures
   - Ethical considerations

3. **Statistical Analysis**:
   - Statistical tests employed
   - Software and tools used
   - Assumptions and limitations
   - Effect sizes and confidence intervals

4. **Methodological Strengths**:
   - What was done well
   - Innovative approaches
   - Rigorous procedures

5. **Methodological Limitations**:
   - Potential biases
   - Confounding variables
   - Generalizability issues
   - Threats to internal/external validity

6. **Novelty Assessment**:
   - What's new about this approach
   - How it differs from existing methods
   - Potential impact on the field

Provide a structured analysis with clear sections and actionable insights. Be specific and cite evidence from the text when possible."""

    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze the methodology of the research paper
        """
        # Extract methodology-related content
        methodology_content = self._extract_relevant_sections(
            documents, 
            ["methods", "methodology", "experimental", "procedure", "materials and methods"]
        )
        
        if not methodology_content:
            return self._format_analysis_result(
                "No methodology section found in the document. This may be a review paper or the methodology section was not clearly identified.",
                confidence=0.3
            )
        
        # Create analysis prompt
        analysis_prompt = f"""
        Please analyze the methodology of this research paper. Focus on:

        1. **Experimental Design**: What type of study is this? How was it designed?
        2. **Data Collection**: What methods were used to collect data?
        3. **Statistical Analysis**: What statistical approaches were employed?
        4. **Strengths**: What methodological strengths does this study have?
        5. **Limitations**: What are the potential methodological limitations?
        6. **Novelty**: What's innovative about this approach?

        Methodology Content:
        {methodology_content}

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
            logger.error(f"Error in methodology analysis: {str(e)}")
            return self._format_analysis_result(
                f"Error analyzing methodology: {str(e)}",
                confidence=0.1
            )
    
    def _extract_methodology_details(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Extract specific methodology details for structured analysis
        """
        methodology_content = self._extract_relevant_sections(
            documents, 
            ["methods", "methodology", "experimental", "procedure"]
        )
        
        # Create a detailed extraction prompt
        extraction_prompt = f"""
        Extract specific methodology details from the following content. Return a structured response with these categories:

        1. **Study Type**: What type of research study is this?
        2. **Participants/Sample**: Who were the participants? How many? How were they recruited?
        3. **Design**: What was the experimental design?
        4. **Procedures**: What were the specific procedures followed?
        5. **Measures**: What instruments or measures were used?
        6. **Analysis**: What statistical analyses were performed?
        7. **Software/Tools**: What software or tools were used?

        Content:
        {methodology_content}
        """
        
        try:
            messages = self._create_messages(extraction_prompt)
            response = self._call_llama(messages)
            
            return {
                "extracted_details": response,
                "raw_content": methodology_content
            }
            
        except Exception as e:
            logger.error(f"Error extracting methodology details: {str(e)}")
            return {
                "error": str(e),
                "raw_content": methodology_content
            }
    
    def assess_methodological_quality(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Assess the overall methodological quality of the research
        """
        methodology_content = self._extract_relevant_sections(
            documents, 
            ["methods", "methodology", "experimental"]
        )
        
        quality_prompt = f"""
        Assess the methodological quality of this research paper. Consider:

        1. **Internal Validity**: How well does the study control for confounding variables?
        2. **External Validity**: How generalizable are the findings?
        3. **Reliability**: How consistent and reproducible are the methods?
        4. **Sample Adequacy**: Is the sample size appropriate and representative?
        5. **Statistical Rigor**: Are the statistical methods appropriate and well-executed?
        6. **Ethical Considerations**: Are ethical issues properly addressed?

        Rate each aspect on a scale of 1-10 and provide justification.

        Methodology Content:
        {methodology_content}
        """
        
        try:
            messages = self._create_messages(quality_prompt)
            response = self._call_llama(messages)
            
            return {
                "quality_assessment": response,
                "confidence": 0.8
            }
            
        except Exception as e:
            logger.error(f"Error in quality assessment: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
