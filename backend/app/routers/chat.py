from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import re
from openai import OpenAI

from app.config import settings
from app.analysis_manager import analysis_manager
from app.agents.pdf_parser_agent import PDFParserAgent

router = APIRouter()
pdf_parser = PDFParserAgent()

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

def rank_chunks(query: str, chunks: List[Any], top_k: int = 5) -> List[Any]:
    """Rank chunks based on word overlap relevance"""
    query_words = set(re.findall(r'\w+', query.lower()))
    if not query_words:
        return chunks[:top_k]
    
    scored_chunks = []
    for chunk in chunks:
        text = chunk.page_content.lower()
        score = sum(3 if word in text else 0 for word in query_words) # simple match weight
        scored_chunks.append((score, chunk))
    
    # Sort by score descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    return [chunk for score, chunk in scored_chunks[:top_k]]

@router.post("/analyses/{analysis_id}/chat", response_model=ChatResponse)
async def chat_with_paper(
    request: ChatRequest,
    analysis_id: str = Path(..., description="Analysis ID")
):
    """
    Query and chat with a research paper
    """
    try:
        # Resolve paper file path
        paper_path = analysis_manager.get_analysis_file_path(analysis_id, "paper")
        if not paper_path or not os.path.exists(paper_path):
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Check if PageIndex is enabled
        if settings.pageindex_api_key:
            try:
                # Load metadata to check if already submitted
                metadata = analysis_manager.get_analysis_metadata(analysis_id)
                doc_id = metadata.get("pageindex_doc_id") if metadata else None
                
                from pageindex import PageIndexClient
                pi_client = PageIndexClient(api_key=settings.pageindex_api_key)
                
                if not doc_id:
                    # Submit document to PageIndex
                    result = pi_client.submit_document(paper_path)
                    doc_id = result.get("doc_id")
                    if doc_id:
                        # Save doc_id in metadata
                        if metadata:
                            metadata["pageindex_doc_id"] = doc_id
                            analysis_manager.save_analysis_metadata(analysis_id, metadata)
                
                if doc_id:
                    # Polling check if document indexing has finished
                    import time
                    ready = False
                    for _ in range(5):
                        try:
                            if pi_client.is_retrieval_ready(doc_id):
                                ready = True
                                break
                        except Exception as check_err:
                            import logging
                            logging.warning(f"Error checking PageIndex doc readiness: {check_err}")
                        time.sleep(1)
                    
                    if not ready:
                        raise RuntimeError("PageIndex document index is not ready yet")

                    # Build history payload
                    history_messages = []
                    for msg in request.history[-6:]:
                        history_messages.append({"role": msg["role"], "content": msg["content"]})
                    history_messages.append({"role": "user", "content": request.message})
                    
                    # Query pageindex using chat_completions with inline citations enabled
                    response = pi_client.chat_completions(
                        messages=history_messages,
                        doc_id=doc_id,
                        enable_citations=True
                    )
                    answer = response["choices"][0]["message"]["content"]
                    
                    # Extract page numbers from inline citations (e.g. <doc=paper.pdf;page=3>)
                    sources = []
                    pages = re.findall(r'page=(\d+)', answer)
                    if pages:
                        for pg in pages:
                            sources.append(f"Page {pg}")
                        # Remove duplicates
                        sources = list(dict.fromkeys(sources))
                        # Format citation markers to standard footnote numbers [X]
                        answer = re.sub(r'<doc=[^>]*page=(\d+)[^>]*>', r'[\1]', answer)
                    else:
                        sources = ["PageIndex Vectorless RAG"]
                        
                    return ChatResponse(answer=answer, sources=sources)
            except Exception as pageindex_error:
                import logging
                logging.warning(f"PageIndex failed, falling back to local chat agent: {pageindex_error}")
        
        # Parse PDF to get chunks
        parse_result = pdf_parser.parse_pdf(paper_path)
        if parse_result["status"] == "error":
            raise HTTPException(status_code=500, detail="Failed to parse paper content for Q&A")
        
        documents = parse_result.get("documents", [])
        if not documents:
            raise HTTPException(status_code=500, detail="No readable content found in paper")
        
        # Retrieve relevant chunks
        relevant_chunks = rank_chunks(request.message, documents, top_k=5)
        context = "\n\n".join([f"[Source Chunk {i+1}]: {chunk.page_content}" for i, chunk in enumerate(relevant_chunks)])
        
        # Build prompt
        system_prompt = (
            "You are an expert academic research assistant chatbot for PaperWise. Your goal is to help researchers understand their paper.\n"
            "Use the provided context chunks from the research paper to answer the user's question accurately. If you don't know the answer or if it's not discussed in the context, state that clearly.\n"
            "Keep your explanation clear, scholarly, and concise.\n\n"
            f"--- PAPER CONTEXT ---\n{context}"
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (max last 6 messages)
        for msg in request.history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": request.message})
        
        # Call LLM client
        client = OpenAI(
            api_key=settings.gemini_api_key,
            base_url=settings.gemini_base_url,
            timeout=settings.request_timeout
        )
        
        completion = client.chat.completions.create(
            model=settings.gemini_model,
            messages=messages,
            temperature=0.2,
            max_tokens=1000
        )
        
        answer = completion.choices[0].message.content
        sources = []
        for chunk in relevant_chunks:
            # Safely check metadata keys
            pg = chunk.metadata.get('page')
            if not pg:
                # If page is not in metadata dictionary, see if we can find page from chunk index or text
                pg = chunk.metadata.get('chunk_index', 0) // 2 + 1
            sources.append(f"Page {pg}")
            
        # Remove duplicate sources
        sources = list(dict.fromkeys(sources))
        
        return ChatResponse(answer=answer, sources=sources)
        
    except Exception as e:
        import logging
        logging.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat query: {str(e)}")
