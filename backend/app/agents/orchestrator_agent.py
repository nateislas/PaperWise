from typing import Dict, List, Any, Optional
from langchain.schema import Document
from langchain.schema import HumanMessage, SystemMessage
import logging
import asyncio
from datetime import datetime

from app.agents.base_agent import BaseAgent
from app.agents.pdf_parser_agent import PDFParserAgent
from app.agents.methodology_agent import MethodologyAgent
from app.agents.results_agent import ResultsAgent
from app.agents.contextualization_agent import ContextualizationAgent

logger = logging.getLogger(__name__)

class OrchestratorAgent(BaseAgent):
    """
    Main orchestrator agent that coordinates all specialized agents and synthesizes their analyses
    """
    
    def __init__(self):
        super().__init__(
            name="Orchestrator Agent",
            description="Coordinates all specialized agents and synthesizes comprehensive analysis"
        )
        
        # Initialize specialized agents
        self.pdf_parser = PDFParserAgent()
        self.methodology_agent = MethodologyAgent()
        self.results_agent = ResultsAgent()
        self.contextualization_agent = ContextualizationAgent()
    
    def _get_system_prompt(self) -> str:
        return """You are the main orchestrator for a comprehensive research paper analysis system.

Your role is to:
1. Coordinate the work of specialized analysis agents
2. Synthesize their findings into a coherent, comprehensive report
3. Ensure all aspects of the research paper are thoroughly analyzed
4. Provide actionable insights for researchers

You should create a well-structured, comprehensive analysis that covers:
- Research problem and motivation
- Methodology and experimental design
- Key findings and statistical significance
- Context within the broader field
- Strengths and limitations
- Future research directions
- Practical implications

Present the analysis in a clear, organized manner that would be valuable to PhD students, researchers, and PIs."""
    
    async def analyze_paper(self, file_path: str, user_query: Optional[str] = None) -> Dict[str, Any]:
        """
        Main method to analyze a research paper using all specialized agents
        """
        try:
            # Step 1: Parse the PDF
            logger.info("Starting PDF parsing...")
            pdf_result = self.pdf_parser.parse_pdf(file_path)
            
            if pdf_result["status"] == "error":
                return {
                    "error": f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}",
                    "status": "error"
                }
            
            documents = pdf_result["documents"]
            parsed_content = pdf_result["parsed_content"]
            
            logger.info(f"PDF parsed successfully. Created {len(documents)} document chunks.")
            
            # Step 2: Run specialized analyses in parallel
            logger.info("Starting specialized analyses...")
            
            # Create tasks for parallel execution
            tasks = [
                self._run_methodology_analysis(documents, user_query),
                self._run_results_analysis(documents, user_query),
                self._run_contextualization_analysis(documents, user_query)
            ]
            
            # Execute all analyses in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            methodology_result, results_result, contextualization_result = results
            
            # Step 3: Synthesize all analyses
            logger.info("Synthesizing analyses...")
            synthesis = await self._synthesize_analyses(
                parsed_content,
                methodology_result,
                results_result,
                contextualization_result,
                user_query
            )
            
            # Step 4: Create comprehensive report
            final_report = self._create_comprehensive_report(
                parsed_content,
                synthesis,
                user_query
            )
            
            return {
                "status": "success",
                "analysis_id": self._generate_analysis_id(),
                "timestamp": datetime.now().isoformat(),
                "metadata": parsed_content["metadata"],
                "comprehensive_analysis": final_report,
                "specialized_analyses": {
                    "methodology": methodology_result,
                    "results": results_result,
                    "contextualization": contextualization_result
                }
            }
            
        except Exception as e:
            logger.error(f"Error in paper analysis: {str(e)}")
            return {
                "error": f"Analysis failed: {str(e)}",
                "status": "error"
            }
    
    async def _run_methodology_analysis(self, documents: List[Document], query: Optional[str]) -> Dict[str, Any]:
        """Run methodology analysis"""
        try:
            return self.methodology_agent.analyze(documents, query)
        except Exception as e:
            logger.error(f"Methodology analysis failed: {str(e)}")
            return {
                "agent": "Methodology Agent",
                "error": str(e),
                "analysis": "Methodology analysis failed due to an error.",
                "confidence": 0.1
            }
    
    async def _run_results_analysis(self, documents: List[Document], query: Optional[str]) -> Dict[str, Any]:
        """Run results analysis"""
        try:
            return self.results_agent.analyze(documents, query)
        except Exception as e:
            logger.error(f"Results analysis failed: {str(e)}")
            return {
                "agent": "Results Agent",
                "error": str(e),
                "analysis": "Results analysis failed due to an error.",
                "confidence": 0.1
            }
    
    async def _run_contextualization_analysis(self, documents: List[Document], query: Optional[str]) -> Dict[str, Any]:
        """Run contextualization analysis"""
        try:
            return self.contextualization_agent.analyze(documents, query)
        except Exception as e:
            logger.error(f"Contextualization analysis failed: {str(e)}")
            return {
                "agent": "Contextualization Agent",
                "error": str(e),
                "analysis": "Contextualization analysis failed due to an error.",
                "confidence": 0.1
            }
    
    async def _synthesize_analyses(self, parsed_content: Dict, methodology_result: Dict, 
                                 results_result: Dict, contextualization_result: Dict,
                                 user_query: Optional[str]) -> Dict[str, Any]:
        """Synthesize all specialized analyses into a coherent whole"""
        
        synthesis_prompt = f"""
        Synthesize the following specialized analyses into a comprehensive, coherent research paper analysis.

        PAPER METADATA:
        Title: {parsed_content.get('metadata', {}).get('title', 'Unknown')}
        Authors: {parsed_content.get('metadata', {}).get('author', 'Unknown')}
        Pages: {parsed_content.get('metadata', {}).get('pages', 'Unknown')}

        USER QUERY: {user_query if user_query else "Comprehensive analysis requested"}

        SPECIALIZED ANALYSES:

        METHODOLOGY ANALYSIS:
        {methodology_result.get('analysis', 'No methodology analysis available')}

        RESULTS ANALYSIS:
        {results_result.get('analysis', 'No results analysis available')}

        CONTEXTUALIZATION ANALYSIS:
        {contextualization_result.get('analysis', 'No contextualization analysis available')}

        Create a comprehensive synthesis that:
        1. Provides a clear overview of the research
        2. Integrates insights from all three analyses
        3. Highlights key findings and implications
        4. Identifies strengths and limitations
        5. Suggests future research directions
        6. Addresses the user's specific query (if provided)

        Structure the synthesis with clear sections and actionable insights.
        """
        
        try:
            messages = self._create_messages(synthesis_prompt)
            response = self._call_llama(messages)
            
            return {
                "synthesis": response,
                "confidence": 0.9,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in synthesis: {str(e)}")
            return {
                "error": str(e),
                "synthesis": "Failed to synthesize analyses due to an error.",
                "confidence": 0.1
            }
    
    def _create_comprehensive_report(self, parsed_content: Dict, synthesis: Dict, 
                                   user_query: Optional[str]) -> Dict[str, Any]:
        """Create the final comprehensive report"""
        
        report = {
            "executive_summary": self._create_executive_summary(parsed_content, synthesis),
            "detailed_analysis": synthesis.get("synthesis", "Analysis synthesis not available"),
            "key_insights": self._extract_key_insights(synthesis),
            "recommendations": self._generate_recommendations(synthesis),
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "user_query": user_query,
                "paper_metadata": parsed_content.get("metadata", {}),
                "analysis_confidence": synthesis.get("confidence", 0.5)
            }
        }
        
        return report
    
    def _create_executive_summary(self, parsed_content: Dict, synthesis: Dict) -> str:
        """Create an executive summary of the analysis"""
        
        summary_prompt = f"""
        Create a concise executive summary (2-3 paragraphs) of this research paper analysis.

        Paper: {parsed_content.get('metadata', {}).get('title', 'Unknown')}
        
        Comprehensive Analysis:
        {synthesis.get('synthesis', 'Analysis not available')}

        The executive summary should:
        1. State the main research problem and approach
        2. Highlight the key findings and their significance
        3. Mention the main strengths and limitations
        4. Indicate the potential impact on the field
        """
        
        try:
            messages = self._create_messages(summary_prompt)
            response = self._call_llama(messages)
            return response
        except Exception as e:
            logger.error(f"Error creating executive summary: {str(e)}")
            return "Executive summary generation failed."
    
    def _extract_key_insights(self, synthesis: Dict) -> List[str]:
        """Extract key insights from the synthesis"""
        
        insights_prompt = f"""
        Extract 5-7 key insights from this research paper analysis. Focus on the most important findings and implications.

        Analysis:
        {synthesis.get('synthesis', 'Analysis not available')}

        Return only the key insights as a numbered list, each in one sentence.
        """
        
        try:
            messages = self._create_messages(insights_prompt)
            response = self._call_llama(messages)
            return [insight.strip() for insight in response.split('\n') if insight.strip()]
        except Exception as e:
            logger.error(f"Error extracting key insights: {str(e)}")
            return ["Key insights extraction failed."]
    
    def _generate_recommendations(self, synthesis: Dict) -> Dict[str, List[str]]:
        """Generate recommendations based on the analysis"""
        
        recommendations_prompt = f"""
        Generate specific recommendations based on this research paper analysis. Provide recommendations in these categories:

        1. For Researchers: What should other researchers do with these findings?
        2. For Future Studies: What specific future research is recommended?
        3. For Practitioners: What practical applications or implementations are suggested?
        4. For Policy Makers: What policy implications or recommendations exist?

        Analysis:
        {synthesis.get('synthesis', 'Analysis not available')}

        Provide 2-3 specific, actionable recommendations for each category.
        """
        
        try:
            messages = self._create_messages(recommendations_prompt)
            response = self._call_llama(messages)
            
            # Parse the response into categories (simplified parsing)
            recommendations = {
                "for_researchers": [],
                "for_future_studies": [],
                "for_practitioners": [],
                "for_policy_makers": []
            }
            
            # Simple parsing - in production, you'd want more sophisticated parsing
            lines = response.split('\n')
            current_category = None
            
            for line in lines:
                line = line.strip()
                if "researchers" in line.lower():
                    current_category = "for_researchers"
                elif "future" in line.lower():
                    current_category = "for_future_studies"
                elif "practitioners" in line.lower():
                    current_category = "for_practitioners"
                elif "policy" in line.lower():
                    current_category = "for_policy_makers"
                elif line and current_category and line[0].isdigit():
                    recommendations[current_category].append(line)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return {
                "for_researchers": ["Recommendation generation failed."],
                "for_future_studies": ["Recommendation generation failed."],
                "for_practitioners": ["Recommendation generation failed."],
                "for_policy_makers": ["Recommendation generation failed."]
            }
    
    def _generate_analysis_id(self) -> str:
        """Generate a unique analysis ID"""
        return f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(datetime.now())}"
    
    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        This method is required by the base class but the main functionality is in analyze_paper
        """
        return {
            "agent": self.name,
            "message": "Orchestrator Agent coordinates specialized agents for comprehensive paper analysis",
            "documents_processed": len(documents)
        }
