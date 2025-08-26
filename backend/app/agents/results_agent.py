from typing import Dict, List, Any, Optional
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging
import re

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class ResultsAgent(BaseAgent):
    """
    Agent specialized in analyzing research results, findings, and statistical significance
    """
    
    def __init__(self):
        super().__init__(
            name="Results Agent",
            description="Analyzes research findings, statistical significance, and interprets results"
        )
    
    def _get_system_prompt(self) -> str:
        return """You are a research results expert specializing in analyzing findings, statistical significance, and data interpretation.

Your role is to critically evaluate the results section of research papers and provide insights on:

1. **Key Findings**:
   - Main results and discoveries
   - Statistical significance of findings
   - Effect sizes and practical significance
   - Patterns and trends in the data

2. **Data Presentation**:
   - Quality of tables and figures
   - Clarity of data presentation
   - Appropriateness of statistical tests
   - Completeness of reporting

3. **Statistical Analysis**:
   - Appropriateness of statistical methods
   - Sample size adequacy
   - Power analysis results
   - Confidence intervals and p-values

4. **Result Interpretation**:
   - How well results support hypotheses
   - Alternative explanations
   - Unexpected findings
   - Implications of results

5. **Data Quality**:
   - Missing data handling
   - Outlier detection and treatment
   - Data distribution assumptions
   - Reliability and validity of measures

6. **Limitations of Results**:
   - Statistical limitations
   - Sample limitations
   - Measurement limitations
   - Generalizability issues

Provide a structured analysis with clear sections and actionable insights. Be specific and cite evidence from the text when possible."""

    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze the results of the research paper
        """
        # Extract results-related content
        results_content = self._extract_relevant_sections(
            documents, 
            ["results", "findings", "outcomes", "data analysis"]
        )
        
        if not results_content:
            return self._format_analysis_result(
                "No results section found in the document. This may be a review paper or the results section was not clearly identified.",
                confidence=0.3
            )
        
        # Create analysis prompt
        analysis_prompt = f"""
        Please analyze the results of this research paper. Focus on:

        1. **Key Findings**: What are the main results and discoveries?
        2. **Statistical Significance**: What statistical tests were used and what do the results show?
        3. **Data Presentation**: How well are the results presented in tables and figures?
        4. **Interpretation**: How do the authors interpret their findings?
        5. **Strengths**: What are the strengths of the results and analysis?
        6. **Limitations**: What limitations exist in the results or their interpretation?

        Results Content:
        {results_content}

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
            logger.error(f"Error in results analysis: {str(e)}")
            return self._format_analysis_result(
                f"Error analyzing results: {str(e)}",
                confidence=0.1
            )
    
    def extract_statistical_findings(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Extract and analyze statistical findings specifically
        """
        results_content = self._extract_relevant_sections(
            documents, 
            ["results", "findings", "statistical", "analysis"]
        )
        
        # Create a detailed statistical analysis prompt
        stats_prompt = f"""
        Extract and analyze statistical findings from the following content. Focus on:

        1. **Statistical Tests Used**: What specific statistical tests were employed?
        2. **P-values and Significance**: What p-values were reported and what do they mean?
        3. **Effect Sizes**: What effect sizes were calculated and what do they indicate?
        4. **Sample Sizes**: What were the sample sizes for different analyses?
        5. **Confidence Intervals**: What confidence intervals were reported?
        6. **Power Analysis**: Was power analysis performed and what were the results?
        7. **Multiple Comparisons**: How were multiple comparisons handled?
        8. **Effect Magnitude**: How large are the effects in practical terms?

        Content:
        {results_content}

        Provide a structured analysis of the statistical findings.
        """
        
        try:
            messages = self._create_messages(stats_prompt)
            response = self._call_llama(messages)
            
            return {
                "statistical_analysis": response,
                "raw_content": results_content
            }
            
        except Exception as e:
            logger.error(f"Error extracting statistical findings: {str(e)}")
            return {
                "error": str(e),
                "raw_content": results_content
            }
    
    def assess_result_quality(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Assess the quality and reliability of the reported results
        """
        results_content = self._extract_relevant_sections(
            documents, 
            ["results", "findings", "outcomes"]
        )
        
        quality_prompt = f"""
        Assess the quality and reliability of the reported results. Consider:

        1. **Completeness**: Are all necessary statistical details reported?
        2. **Transparency**: Is the analysis transparent and reproducible?
        3. **Appropriateness**: Are the statistical methods appropriate for the data?
        4. **Effect Size Reporting**: Are effect sizes reported and interpreted?
        5. **Multiple Testing**: How are multiple comparisons handled?
        6. **Data Quality**: How is data quality addressed?
        7. **Missing Data**: How is missing data handled?
        8. **Outliers**: How are outliers identified and treated?

        Rate each aspect on a scale of 1-10 and provide justification.

        Results Content:
        {results_content}
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
    
    def identify_key_findings(self, documents: List[Document]) -> Dict[str, Any]:
        """
        Identify and summarize the key findings from the research
        """
        results_content = self._extract_relevant_sections(
            documents, 
            ["results", "findings", "conclusions"]
        )
        
        findings_prompt = f"""
        Identify and summarize the key findings from this research. Focus on:

        1. **Primary Findings**: What are the main discoveries?
        2. **Secondary Findings**: What are the supporting or additional findings?
        3. **Unexpected Results**: Were there any surprising or unexpected findings?
        4. **Negative Results**: Were there any null findings or failed hypotheses?
        5. **Practical Significance**: What are the practical implications of the findings?
        6. **Theoretical Significance**: What are the theoretical implications?

        Organize findings by importance and provide clear, concise summaries.

        Content:
        {results_content}
        """
        
        try:
            messages = self._create_messages(findings_prompt)
            response = self._call_llama(messages)
            
            return {
                "key_findings": response,
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Error identifying key findings: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.1
            }
    
    def _extract_p_values(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract p-values from text using regex patterns
        """
        p_values = []
        
        # Common p-value patterns
        patterns = [
            r'p\s*[<≤]\s*0\.0*1',  # p < 0.01
            r'p\s*[<≤]\s*0\.0*5',  # p < 0.05
            r'p\s*=\s*0\.\d+',     # p = 0.xxx
            r'p\s*[<≤]\s*0\.\d+',  # p < 0.xxx
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                p_values.append({
                    "value": match.group(),
                    "position": match.start(),
                    "context": text[max(0, match.start()-50):match.end()+50]
                })
        
        return p_values
    
    def _extract_effect_sizes(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract effect sizes from text
        """
        effect_sizes = []
        
        # Common effect size patterns
        patterns = [
            r'r\s*=\s*[+-]?0\.\d+',      # correlation coefficient
            r'd\s*=\s*[+-]?0\.\d+',      # Cohen's d
            r'η²\s*=\s*0\.\d+',          # eta squared
            r'R²\s*=\s*0\.\d+',          # R squared
            r'OR\s*=\s*\d+\.\d+',        # odds ratio
            r'RR\s*=\s*\d+\.\d+',        # risk ratio
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                effect_sizes.append({
                    "value": match.group(),
                    "position": match.start(),
                    "context": text[max(0, match.start()-50):match.end()+50]
                })
        
        return effect_sizes
