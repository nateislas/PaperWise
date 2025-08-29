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
from app.agents.field_classifier_agent import FieldClassifierAgent
from app.agents.section_registry import FIELD_TO_SECTION_SPECS
from app.agents.structured_section_extractor import StructuredSectionExtractor

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
        # New components
        self.field_classifier = FieldClassifierAgent()
        self.section_extractor = StructuredSectionExtractor()
    
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
            parsed_figures = parsed_content.get("figures", []) if isinstance(parsed_content, dict) else []
            paper_metadata = pdf_result.get("metadata", {})
            
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": f"PDF parsed successfully. Created {len(documents)} document chunks.",
                "progress": 20
            }
            
            # Step 2: Field classification
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Classifying paper field...",
                "progress": 25
            }

            # Prepare text for classification (use parsed_content text if available)
            if isinstance(parsed_content, dict):
                text_content = parsed_content.get("text_content", "")
            else:
                text_content = str(parsed_content)

            classification = await self.field_classifier.classify(text_content)
            detected_field = classification.get("field", "generic")
            subfield = classification.get("subfield", "")
            conferences = classification.get("conferences", [])
            field_confidence = classification.get("confidence", 0.5)

            field_display = detected_field
            if subfield:
                field_display = f"{detected_field} ({subfield})"
            if conferences:
                field_display += f" - {', '.join(conferences[:3])}"

            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": f"Detected: {field_display} ({int(field_confidence*100)}% conf)",
                "progress": 28
            }

            # Determine sections to extract
            section_specs = FIELD_TO_SECTION_SPECS.get(detected_field) or FIELD_TO_SECTION_SPECS.get("generic", [])

            # Step 3: Run specialized analyses with streaming
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
            
            # Extract structured sections per field
            structured_sections = []
            if section_specs:
                yield {
                    "type": "status",
                    "analysis_id": analysis_id,
                    "message": "Extracting field-specific sections...",
                    "progress": 66
                }
                for spec in section_specs:
                    section = await self.section_extractor.extract_section(documents, spec)
                    # If section has diagram_refs and we have parsed figures, attempt to resolve to URLs
                    try:
                        data = section.get("data") or {}
                        refs = data.get("diagram_refs") if isinstance(data, dict) else None
                        if isinstance(refs, list) and parsed_figures:
                            resolved = []
                            for ref in refs:
                                if not isinstance(ref, str):
                                    continue
                                # Normalize like "Fig. 1.3" -> lowercase without spaces
                                norm = ref.lower().replace(" ", "")
                                match = None
                                for fig in parsed_figures:
                                    label = str(fig.get("label", "")).lower().replace(" ", "")
                                    if label and norm in label:
                                        match = {
                                            "ref": ref,
                                            "label": fig.get("label"),
                                            "url": fig.get("url"),
                                            "page": fig.get("page"),
                                        }
                                        break
                                if match:
                                    resolved.append(match)
                            if resolved:
                                data["diagram_urls"] = resolved
                                section["data"] = data
                    except Exception as _:
                        pass
                    structured_sections.append(section)

            # Step 4: Synthesize analyses
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
            
            # Step 5: Create final report
            yield {
                "type": "status",
                "analysis_id": analysis_id,
                "message": "Finalizing analysis report...",
                "progress": 90
            }
            
            final_report = self._create_final_report(comprehensive_analysis, analysis_id)
            # Attach field awareness outputs
            final_report["field"] = detected_field
            final_report["subfield"] = subfield
            final_report["conferences"] = conferences
            final_report["field_confidence"] = field_confidence
            final_report["sections"] = structured_sections
            final_report["figures"] = parsed_figures
            # Attach paper metadata
            final_report["paper_info"] = paper_metadata
            
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
            
            prompt = f"""You are a senior research advisor analyzing a paper for PhD students and researchers. Provide a critical, evidence-grounded analysis that helps readers understand the work's significance and limitations.

PAPER CONTENT:
{text_content}

METHODOLOGY ANALYSIS:
{methodology_content}

RESULTS ANALYSIS:
{results_content}

CONTEXTUALIZATION ANALYSIS:
{contextualization_content}

{f"USER QUERY: {user_query}" if user_query else ""}

Create a comprehensive analysis that addresses what researchers actually need to know. Return it as a JSON object with the following structure. Base all claims on evidence from the provided analyses; do not speculate or include generic statements.

{{
  "executive_summary": "2-3 paragraphs: What problem does this solve? What's the key innovation? What are the main results?",
  "novelty_assessment": {{
    "key_innovation": "What is genuinely new here? Be specific about the technical contribution",
    "incremental_advances": ["List of smaller improvements or refinements (0-5 items)"],
    "novelty_score": "high/medium/low - how significant is this contribution?",
    "justification": "Why this score? What makes this work stand out or fall short?"
  }},
  "gap_analysis": {{
    "problem_statement": "What specific gap or limitation does this work address?",
    "motivation": "Why is this gap important to fill?",
    "scope": "What aspects of the problem are NOT addressed?"
  }},
  "methodological_evaluation": {{
    "approach_strength": "What are the strongest aspects of the methodology?",
    "potential_issues": ["List of methodological concerns or limitations (0-5 items)"],
    "rigor_assessment": "high/medium/low - how well-controlled and validated is this work?",
    "reproducibility": "What would be needed to reproduce this work? What's missing?"
  }},
  "evidence_quality": {{
    "empirical_support": "How strong is the evidence for the main claims?",
    "key_results": ["Most important empirical findings with specific metrics (0-5 items)"],
    "statistical_significance": "Are the results statistically sound? Any concerns?",
    "baseline_comparison": "How do the baselines compare? Are they appropriate?"
  }},
  "impact_assessment": {{
    "theoretical_contribution": "What does this add to our theoretical understanding?",
    "practical_significance": "What are the real-world implications?",
    "field_impact": "How might this influence future research in this area?"
  }},
  "research_opportunities": {{
    "immediate_extensions": ["Logical next steps that build directly on this work (0-5 items)"],
    "broader_directions": ["Research directions this enables in related areas (0-5 items)"],
    "open_questions": ["Important questions this work raises but doesn't answer (0-5 items)"]
  }},
  "implementation_guide": {{
    "complexity": "high/medium/low - how difficult would this be to implement?",
    "requirements": ["Key resources, data, or expertise needed (0-5 items)"],
    "missing_details": ["What important implementation details are unclear or missing (0-5 items)"],
    "estimated_effort": "Rough estimate: weeks/months/years for a skilled researcher"
  }},
  "critical_review": {{
    "major_strengths": ["Most compelling aspects of this work (0-5 items)"],
    "major_concerns": ["Most significant limitations or potential issues (0-5 items)"],
    "alternative_approaches": ["Other ways this problem could be approached (0-3 items)"],
    "robustness": "How robust are the conclusions? What could invalidate them?"
  }}
}}

Return ONLY the JSON object. Be specific and evidence-based. If a section cannot be meaningfully filled from the provided analyses, use an empty array or null rather than generic statements."""

            return prompt
            
        except Exception as e:
            logger.error(f"Error creating synthesis prompt: {str(e)}")
            logger.error(f"parsed_content type: {type(parsed_content)}")
            logger.error(f"parsed_content: {parsed_content}")
            
            # Fallback prompt without parsed_content
            prompt = f"""You are a senior research advisor analyzing a paper for PhD students and researchers. Provide a critical, evidence-grounded analysis that helps readers understand the work's significance and limitations.

METHODOLOGY ANALYSIS:
{methodology_content}

RESULTS ANALYSIS:
{results_content}

CONTEXTUALIZATION ANALYSIS:
{contextualization_content}

{f"USER QUERY: {user_query}" if user_query else ""}

Create a comprehensive analysis that addresses what researchers actually need to know. Return it as a JSON object with the following structure. Base all claims on evidence from the provided analyses; do not speculate or include generic statements.

{{
  "executive_summary": "2-3 paragraphs: What problem does this solve? What's the key innovation? What are the main results?",
  "novelty_assessment": {{
    "key_innovation": "What is genuinely new here? Be specific about the technical contribution",
    "incremental_advances": ["List of smaller improvements or refinements (0-5 items)"],
    "novelty_score": "high/medium/low - how significant is this contribution?",
    "justification": "Why this score? What makes this work stand out or fall short?"
  }},
  "gap_analysis": {{
    "problem_statement": "What specific gap or limitation does this work address?",
    "motivation": "Why is this gap important to fill?",
    "scope": "What aspects of the problem are NOT addressed?"
  }},
  "methodological_evaluation": {{
    "approach_strength": "What are the strongest aspects of the methodology?",
    "potential_issues": ["List of methodological concerns or limitations (0-5 items)"],
    "rigor_assessment": "high/medium/low - how well-controlled and validated is this work?",
    "reproducibility": "What would be needed to reproduce this work? What's missing?"
  }},
  "evidence_quality": {{
    "empirical_support": "How strong is the evidence for the main claims?",
    "key_results": ["Most important empirical findings with specific metrics (0-5 items)"],
    "statistical_significance": "Are the results statistically sound? Any concerns?",
    "baseline_comparison": "How do the baselines compare? Are they appropriate?"
  }},
  "impact_assessment": {{
    "theoretical_contribution": "What does this add to our theoretical understanding?",
    "practical_significance": "What are the real-world implications?",
    "field_impact": "How might this influence future research in this area?"
  }},
  "research_opportunities": {{
    "immediate_extensions": ["Logical next steps that build directly on this work (0-5 items)"],
    "broader_directions": ["Research directions this enables in related areas (0-5 items)"],
    "open_questions": ["Important questions this work raises but doesn't answer (0-5 items)"]
  }},
  "implementation_guide": {{
    "complexity": "high/medium/low - how difficult would this be to implement?",
    "requirements": ["Key resources, data, or expertise needed (0-5 items)"],
    "missing_details": ["What important implementation details are unclear or missing (0-5 items)"],
    "estimated_effort": "Rough estimate: weeks/months/years for a skilled researcher"
  }},
  "critical_review": {{
    "major_strengths": ["Most compelling aspects of this work (0-5 items)"],
    "major_concerns": ["Most significant limitations or potential issues (0-5 items)"],
    "alternative_approaches": ["Other ways this problem could be approached (0-3 items)"],
    "robustness": "How robust are the conclusions? What could invalidate them?"
  }}
}}

Return ONLY the JSON object. Be specific and evidence-based. If a section cannot be meaningfully filled from the provided analyses, use an empty array or null rather than generic statements."""

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
