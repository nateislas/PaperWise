import asyncio
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator, Union
from langchain.schema import Document
import uuid
import time

from app.agents.base_agent import BaseAgent
from app.agents.methodology_agent import MethodologyAgent
from app.agents.results_agent import ResultsAgent
from app.agents.contextualization_agent import ContextualizationAgent
from app.agents.pdf_parser_agent import PDFParserAgent
from app.config import settings

logger = logging.getLogger(__name__)

class OrchestratorAgent(BaseAgent):
    """
    Main orchestrator agent that coordinates all specialized analysis agents
    """
    
    def __init__(self):
        super().__init__("Orchestrator", "Main coordinator for comprehensive analysis")
        
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
    
    async def analyze_paper_stream(self, file_path: str, user_query: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream analysis of a research paper with real-time updates
        """
        logger.info(f"🎯 ORCHESTRATOR: Starting streaming analysis")
        logger.info(f"📁 File path: {file_path}")
        logger.info(f"❓ User query: {user_query}")
        
        analysis_id = str(uuid.uuid4())
        start_time = time.time()
        logger.info(f"🆔 Analysis ID: {analysis_id}")
        
        try:
            # Send initial status
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Starting analysis...",
                "progress": 0
            }
            
            # Step 1: Parse the PDF
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Parsing PDF document...",
                "progress": 10
            }
            
            pdf_result = self.pdf_parser.parse_pdf(file_path)
            
            if pdf_result["status"] == "error":
                yield {
                    "type": "error",
                    "analysis_id": analysis_id,
                    "message": f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}"
                }
                return
            
            documents = pdf_result["documents"]
            parsed_content = pdf_result["parsed_content"]
            
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": f"PDF parsed successfully. Created {len(documents)} document chunks.",
                "progress": 20
            }
            
            # Step 2: Run specialized analyses with streaming
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Starting specialized analyses...",
                "progress": 30
            }
            
            # Run analyses sequentially but with better streaming
            methodology_content = ""
            results_content = ""
            contextualization_content = ""
            
            # Process methodology analysis
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Analyzing methodology...",
                "progress": 40
            }
            
            methodology_start = time.time()
            chunk_count = 0
            async for chunk in self.methodology_agent.analyze_stream(documents, user_query):
                methodology_content += chunk
                chunk_count += 1
                yield {
                    "type": "methodology_chunk",
                    "analysis_id": analysis_id,
                    "content": chunk,
                    "progress": 45
                }
                # Minimal delay for responsive streaming
                await asyncio.sleep(0.005)
            
            methodology_time = time.time() - methodology_start
            logger.info(f"Methodology analysis completed in {methodology_time:.2f}s with {chunk_count} chunks")
            
            # Process results analysis
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Analyzing results...",
                "progress": 50
            }
            
            results_start = time.time()
            chunk_count = 0
            async for chunk in self.results_agent.analyze_stream(documents, user_query):
                results_content += chunk
                chunk_count += 1
                yield {
                    "type": "results_chunk",
                    "analysis_id": analysis_id,
                    "content": chunk,
                    "progress": 55
                }
                # Minimal delay for responsive streaming
                await asyncio.sleep(0.005)
            
            results_time = time.time() - results_start
            logger.info(f"Results analysis completed in {results_time:.2f}s with {chunk_count} chunks")
            
            # Process contextualization analysis
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Analyzing context and implications...",
                "progress": 60
            }
            
            context_start = time.time()
            chunk_count = 0
            async for chunk in self.contextualization_agent.analyze_stream(documents, user_query):
                contextualization_content += chunk
                chunk_count += 1
                yield {
                    "type": "contextualization_chunk",
                    "analysis_id": analysis_id,
                    "content": chunk,
                    "progress": 65
                }
                # Minimal delay for responsive streaming
                await asyncio.sleep(0.005)
            
            context_time = time.time() - context_start
            logger.info(f"Contextualization analysis completed in {context_time:.2f}s with {chunk_count} chunks")
            
            # Step 3: Synthesize analyses
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Synthesizing comprehensive analysis...",
                "progress": 70
            }
            
            synthesis_prompt = self._create_synthesis_prompt(
                parsed_content,
                methodology_content,
                results_content,
                contextualization_content,
                user_query
            )
            
            comprehensive_analysis = ""
            async for chunk in self._call_llama_stream([{"role": "user", "content": synthesis_prompt}]):
                comprehensive_analysis += chunk
                yield {
                    "type": "synthesis_chunk",
                    "analysis_id": analysis_id,
                    "content": chunk,
                    "progress": 85
                }
                # Minimal delay for responsive streaming
                await asyncio.sleep(0.005)
            
            # Step 4: Create final report
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Finalizing analysis report...",
                "progress": 90
            }
            
            final_report = self._create_final_report(comprehensive_analysis, analysis_id)
            
            # Send final result
            yield {
                "type": "complete",
                "analysis_id": analysis_id,
                "status": "success",
                "message": "Analysis completed successfully",
                "analysis": final_report,
                "progress": 100,
                "elapsed_time": time.time() - start_time
            }
            
        except Exception as e:
            logger.error(f"Error in streaming analysis: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e}")
            yield {
                "type": "error",
                "analysis_id": analysis_id,
                "message": f"Analysis failed: {str(e)}"
            }
    
    async def _stream_methodology_analysis(self, documents: List[Document], user_query: Optional[str], analysis_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream methodology analysis with proper chunk data"""
        yield {
            "type": "status",
            "analysis_id": analysis_id,
            "message": "Analyzing methodology...",
            "progress": 40
        }
        
        async for chunk in self.methodology_agent.analyze_stream(documents, user_query):
            yield {
                "type": "methodology_chunk",
                "analysis_id": analysis_id,
                "content": chunk,
                "progress": 45
            }
    
    async def _stream_results_analysis(self, documents: List[Document], user_query: Optional[str], analysis_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream results analysis with proper chunk data"""
        yield {
            "type": "status",
            "analysis_id": analysis_id,
            "message": "Analyzing results...",
            "progress": 50
        }
        
        async for chunk in self.results_agent.analyze_stream(documents, user_query):
            yield {
                "type": "results_chunk",
                "analysis_id": analysis_id,
                "content": chunk,
                "progress": 55
            }
    
    async def _stream_contextualization_analysis(self, documents: List[Document], user_query: Optional[str], analysis_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream contextualization analysis with proper chunk data"""
        yield {
            "type": "status",
            "analysis_id": analysis_id,
            "message": "Analyzing context and implications...",
            "progress": 60
        }
        
        async for chunk in self.contextualization_agent.analyze_stream(documents, user_query):
            yield {
                "type": "contextualization_chunk",
                "analysis_id": analysis_id,
                "content": chunk,
                "progress": 65
            }
    
    async def _run_methodology_analysis_stream(self, documents: List[Document], user_query: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Run methodology analysis with streaming"""
        async for chunk in self.methodology_agent.analyze_stream(documents, user_query):
            yield chunk
    
    async def _run_results_analysis_stream(self, documents: List[Document], user_query: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Run results analysis with streaming"""
        async for chunk in self.results_agent.analyze_stream(documents, user_query):
            yield chunk
    
    async def _run_contextualization_analysis_stream(self, documents: List[Document], user_query: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Run contextualization analysis with streaming"""
        async for chunk in self.contextualization_agent.analyze_stream(documents, user_query):
            yield chunk
    
    def _create_synthesis_prompt(self, parsed_content: Union[str, Dict[str, Any]], methodology_content: str, results_content: str, contextualization_content: str, user_query: Optional[str] = None) -> str:
        """Create a prompt for synthesizing all analyses"""
        
        try:
            # Handle parsed_content - it could be a string or a dictionary
            if isinstance(parsed_content, dict):
                # Extract text content from the dictionary
                text_content = parsed_content.get("text_content", "")
                # Truncate text content if it's too long
                if len(text_content) > 5000:
                    text_content = text_content[:5000] + "..."
            else:
                # If it's already a string, truncate it
                text_content = str(parsed_content)
                if len(text_content) > 5000:
                    text_content = text_content[:5000] + "..."
            
            prompt = f"""Based on the following specialized analyses of a research paper, create a comprehensive, well-structured analysis report.

PAPER CONTENT:
{text_content}

METHODOLOGY ANALYSIS:
{methodology_content}

RESULTS ANALYSIS:
{results_content}

CONTEXTUALIZATION ANALYSIS:
{contextualization_content}

{f"USER QUERY: {user_query}" if user_query else ""}

Please create a comprehensive analysis and return it as a JSON object with the following EXACT structure:

{{
  "executive_summary": "2-3 paragraphs providing a concise overview of the research, key findings, and significance",
  "key_insights": [
    "Insight 1: Main finding or contribution",
    "Insight 2: Key methodological innovation", 
    "Insight 3: Significant result or breakthrough",
    "Insight 4: Important limitation or challenge",
    "Insight 5: Future research direction"
  ],
  "detailed_analysis": {{
    "research_problem": "Explain the research question, hypothesis, and why this work is important",
    "methodology": "Critical evaluation of the methods, experimental design, and approach",
    "key_findings": "Synthesis of main results, statistical significance, and data interpretation",
    "context": "How this work relates to existing literature and contributes to the field",
    "strengths_limitations": "**Strengths:**\\n- Strength 1\\n- Strength 2\\n- Strength 3\\n\\n**Limitations:**\\n- Limitation 1\\n- Limitation 2\\n- Limitation 3",
    "future_directions": "1. Future direction 1\\n2. Future direction 2\\n3. Future direction 3"
  }},
  "recommendations": {{
    "for_researchers": [
      "Specific recommendation for researchers",
      "Specific recommendation for researchers", 
      "Specific recommendation for researchers"
    ],
    "for_practitioners": [
      "Specific recommendation for practitioners/clinicians",
      "Specific recommendation for practitioners/clinicians"
    ]
  }}
}}

Return ONLY the JSON object, no additional text or markdown formatting. Be specific and actionable in all sections."""

            return prompt
            
        except Exception as e:
            logger.error(f"Error creating synthesis prompt: {str(e)}")
            logger.error(f"parsed_content type: {type(parsed_content)}")
            logger.error(f"parsed_content: {parsed_content}")
            
            # Fallback prompt without parsed_content
            prompt = f"""Based on the following specialized analyses of a research paper, create a comprehensive, well-structured analysis report.

METHODOLOGY ANALYSIS:
{methodology_content}

RESULTS ANALYSIS:
{results_content}

CONTEXTUALIZATION ANALYSIS:
{contextualization_content}

{f"USER QUERY: {user_query}" if user_query else ""}

Please create a comprehensive analysis and return it as a JSON object with the following EXACT structure:

{{
  "executive_summary": "2-3 paragraphs providing a concise overview of the research, key findings, and significance",
  "key_insights": [
    "Insight 1: Main finding or contribution",
    "Insight 2: Key methodological innovation", 
    "Insight 3: Significant result or breakthrough",
    "Insight 4: Important limitation or challenge",
    "Insight 5: Future research direction"
  ],
  "detailed_analysis": {{
    "research_problem": "Explain the research question, hypothesis, and why this work is important",
    "methodology": "Critical evaluation of the methods, experimental design, and approach",
    "key_findings": "Synthesis of main results, statistical significance, and data interpretation",
    "context": "How this work relates to existing literature and contributes to the field",
    "strengths_limitations": "**Strengths:**\\n- Strength 1\\n- Strength 2\\n- Strength 3\\n\\n**Limitations:**\\n- Limitation 1\\n- Limitation 2\\n- Limitation 3",
    "future_directions": "1. Future direction 1\\n2. Future direction 2\\n3. Future direction 3"
  }},
  "recommendations": {{
    "for_researchers": [
      "Specific recommendation for researchers",
      "Specific recommendation for researchers", 
      "Specific recommendation for researchers"
    ],
    "for_practitioners": [
      "Specific recommendation for practitioners/clinicians",
      "Specific recommendation for practitioners/clinicians"
    ]
  }}
}}

Return ONLY the JSON object, no additional text or markdown formatting. Be specific and actionable in all sections."""

            return prompt
    
    def _create_final_report(self, comprehensive_analysis: str, analysis_id: str) -> Dict[str, Any]:
        """Create the final analysis report"""
        return {
            "analysis_id": analysis_id,
            "comprehensive_analysis": comprehensive_analysis,
            "metadata": {
                "analysis_timestamp": self._get_timestamp(),
                "analysis_confidence": 0.85,
                "model_used": settings.llama_model
            }
        }
    
    async def analyze_paper(self, file_path: str, user_query: Optional[str] = None) -> Dict[str, Any]:
        """
        Legacy synchronous method for backward compatibility
        """
        analysis_id = str(uuid.uuid4())
        
        try:
            # Parse PDF
            pdf_result = self.pdf_parser.parse_pdf(file_path)
            
            if pdf_result["status"] == "error":
                return {
                    "error": f"Failed to parse PDF: {pdf_result.get('error', 'Unknown error')}",
                    "status": "error"
                }
            
            documents = pdf_result["documents"]
            parsed_content = pdf_result["parsed_content"]
            
            # Run analyses in parallel
            tasks = [
                self._run_methodology_analysis(documents, user_query),
                self._run_results_analysis(documents, user_query),
                self._run_contextualization_analysis(documents, user_query)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            methodology_result, results_result, contextualization_result = results
            
            # Synthesize analyses
            synthesis = await self._synthesize_analyses(
                parsed_content,
                methodology_result,
                results_result,
                contextualization_result,
                user_query
            )
            
            # Create final report
            final_report = self._create_final_report(synthesis, analysis_id)
            
            return {
                "analysis_id": analysis_id,
                "status": "success",
                "comprehensive_analysis": final_report
            }
            
        except Exception as e:
            logger.error(f"Error in analysis: {str(e)}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    async def _run_methodology_analysis(self, documents: List[Document], user_query: Optional[str] = None) -> str:
        """Run methodology analysis synchronously"""
        content = ""
        async for chunk in self.methodology_agent.analyze_stream(documents, user_query):
            content += chunk
        return content
    
    async def _run_results_analysis(self, documents: List[Document], user_query: Optional[str] = None) -> str:
        """Run results analysis synchronously"""
        content = ""
        async for chunk in self.results_agent.analyze_stream(documents, user_query):
            content += chunk
        return content
    
    async def _run_contextualization_analysis(self, documents: List[Document], user_query: Optional[str] = None) -> str:
        """Run contextualization analysis synchronously"""
        content = ""
        async for chunk in self.contextualization_agent.analyze_stream(documents, user_query):
            content += chunk
        return content
    
    async def _synthesize_analyses(self, parsed_content: Union[str, Dict[str, Any]], methodology_result: str, results_result: str, contextualization_result: str, user_query: Optional[str] = None) -> str:
        """Synthesize all analyses into a comprehensive report"""
        synthesis_prompt = self._create_synthesis_prompt(
            parsed_content,
            methodology_result,
            results_result,
            contextualization_result,
            user_query
        )
        
        content = ""
        async for chunk in self._call_llama_stream([{"role": "user", "content": synthesis_prompt}]):
            content += chunk
        return content
    
    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        Required implementation of the abstract analyze method
        This method is required by the BaseAgent abstract class
        """
        return {
            "agent": self.name,
            "message": "Orchestrator Agent coordinates specialized agents for comprehensive paper analysis",
            "documents_processed": len(documents),
            "status": "ready"
        }
