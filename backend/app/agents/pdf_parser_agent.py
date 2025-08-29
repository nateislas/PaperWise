import fitz  # PyMuPDF
from typing import Dict, List, Any, Optional
from langchain.schema import Document
import logging
import os
from datetime import datetime

from app.agents.base_agent import BaseAgent
import re
from app.config import settings
import pathlib

logger = logging.getLogger(__name__)

class PDFParserAgent(BaseAgent):
    """
    Agent responsible for parsing PDF files and extracting text, tables, and figures
    """
    
    def __init__(self):
        super().__init__(
            name="PDF Parser Agent",
            description="Extracts and processes text, tables, and figures from PDF documents"
        )
    
    def _get_system_prompt(self) -> str:
        return """You are a PDF parsing expert specializing in extracting and organizing content from research papers.

Your role is to:
1. Extract text content from PDF documents
2. Identify and extract tables and figures
3. Organize content into logical sections
4. Preserve document structure and formatting
5. Handle various PDF formats and layouts

Provide clean, well-structured content that can be used by other analysis agents."""
    
    def parse_pdf(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a PDF file and extract its content
        """
        try:
            if not os.path.exists(file_path):
                return {
                    "status": "error",
                    "error": f"File not found: {file_path}"
                }
            
            logger.info(f"Parsing PDF: {file_path}")
            
            # Open the PDF
            doc = fitz.open(file_path)
            
            # Extract metadata
            metadata = self._extract_metadata(doc)
            
            # Extract text content
            text_content = self._extract_text(doc)
            
            # Extract tables
            tables = self._extract_tables(doc)
            
            # Extract figures (save image assets and collect metadata)
            figures = self._extract_figures(doc, file_path)
            
            # Create document chunks
            documents = self._create_documents(text_content, metadata)
            
            # Close the document
            doc.close()
            
            logger.info(f"Successfully parsed PDF. Created {len(documents)} document chunks.")
            
            return {
                "status": "success",
                "documents": documents,
                "metadata": metadata,
                "parsed_content": {
                    "text_content": text_content,
                    "tables": tables,
                    "figures": figures,
                    "metadata": metadata
                }
            }
            
        except Exception as e:
            logger.error(f"Error parsing PDF {file_path}: {str(e)}")
            return {
                "status": "error",
                "error": f"Failed to parse PDF: {str(e)}"
            }
    
    def _extract_metadata(self, doc) -> Dict[str, Any]:
        """Extract metadata from the PDF"""
        try:
            metadata = doc.metadata
            
            # Extract basic metadata from PDF
            basic_metadata = {
                "title": metadata.get("title", "Unknown"),
                "author": metadata.get("author", "Unknown"),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "pages": len(doc),
                "file_size": os.path.getsize(doc.name) if hasattr(doc, 'name') else 0,
                "parsed_at": datetime.now().isoformat()
            }
            
            # Log the basic metadata for debugging
            logger.info(f"Basic metadata extracted - Title: '{basic_metadata['title']}', Author: '{basic_metadata['author']}'")
            
            # If basic metadata is missing or generic, try LLM extraction
            if (basic_metadata["title"] == "Unknown" or 
                basic_metadata["author"] == "Unknown" or
                basic_metadata["title"] == "" or
                basic_metadata["author"] == ""):
                
                logger.info("Basic metadata missing, attempting LLM extraction")
                llm_metadata = self._extract_metadata_with_llm(doc)
                
                # Merge LLM metadata with basic metadata, preferring LLM results
                if llm_metadata.get("title") and llm_metadata["title"] != "Unknown":
                    basic_metadata["title"] = llm_metadata["title"]
                if llm_metadata.get("author") and llm_metadata["author"] != "Unknown":
                    basic_metadata["author"] = llm_metadata["author"]
                if llm_metadata.get("authors"):
                    basic_metadata["authors"] = llm_metadata["authors"]
            else:
                logger.info("Basic metadata is present, skipping LLM extraction")
            
            return basic_metadata
            
        except Exception as e:
            logger.warning(f"Error extracting metadata: {str(e)}")
            return {
                "title": "Unknown",
                "author": "Unknown",
                "pages": len(doc),
                "parsed_at": datetime.now().isoformat()
            }
    
    def _extract_text(self, doc) -> str:
        """Extract text content from all pages"""
        text_content = []
        
        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                text = page.get_text()
                if text.strip():
                    text_content.append(f"--- Page {page_num + 1} ---\n{text}")
            except Exception as e:
                logger.warning(f"Error extracting text from page {page_num + 1}: {str(e)}")
                continue
        
        return "\n\n".join(text_content)
    
    def _extract_metadata_with_llm(self, doc) -> Dict[str, Any]:
        """Extract paper metadata using LLM from the first few pages"""
        try:
            # Extract text from first 3 pages (usually contains title, authors, abstract)
            first_pages_text = ""
            for page_num in range(min(3, len(doc))):
                try:
                    page = doc.load_page(page_num)
                    text = page.get_text()
                    if text.strip():
                        first_pages_text += f"\n--- Page {page_num + 1} ---\n{text}"
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num + 1}: {str(e)}")
                    continue
            
            if not first_pages_text.strip():
                return {"title": "Unknown", "author": "Unknown"}
            
            # Create prompt for LLM metadata extraction
            prompt = f"""Extract the paper title and authors from the following text. This is from the first few pages of a research paper.

Text:
{first_pages_text[:2000]}  # Limit to first 2000 chars to avoid token limits

Please extract and return ONLY a JSON object with the following structure:
{{
    "title": "The exact paper title",
    "author": "First author name",
    "authors": ["List of all author names"]
}}

Rules:
1. Extract the main paper title, not section titles
2. Include all authors if multiple
3. Use the exact names as they appear
4. If you can't find clear title/author information, use "Unknown"
5. Return ONLY the JSON object, no other text

JSON:"""
            
            # Call LLM to extract metadata
            response = self._call_llama([{"role": "user", "content": prompt}])
            
            if not response:
                return {"title": "Unknown", "author": "Unknown"}
            
            # Try to parse JSON response
            try:
                import json
                # Clean the response to extract just the JSON
                response_text = response.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                metadata = json.loads(response_text.strip())
                
                # Validate and clean the extracted metadata
                title = metadata.get("title", "Unknown")
                author = metadata.get("author", "Unknown")
                authors = metadata.get("authors", [])
                
                # Clean up the data
                if title and title != "Unknown" and len(title) > 3:
                    title = title.strip()
                else:
                    title = "Unknown"
                
                if author and author != "Unknown" and len(author) > 2:
                    author = author.strip()
                else:
                    author = "Unknown"
                
                if authors and isinstance(authors, list):
                    authors = [a.strip() for a in authors if a and a.strip() and a.strip() != "Unknown"]
                
                logger.info(f"LLM extracted metadata - Title: {title}, Author: {author}")
                
                return {
                    "title": title,
                    "author": author,
                    "authors": authors
                }
                
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to parse LLM metadata response: {str(e)}")
                return {"title": "Unknown", "author": "Unknown"}
                
        except Exception as e:
            logger.warning(f"Error in LLM metadata extraction: {str(e)}")
            return {"title": "Unknown", "author": "Unknown"}
    
    def _extract_tables(self, doc) -> List[Dict[str, Any]]:
        """Extract tables from the PDF"""
        tables = []
        
        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                
                # Try different methods to extract tables
                table_list = []
                try:
                    # Try find_tables() method (newer PyMuPDF versions)
                    table_finder = page.find_tables()
                    table_list = table_finder.tables
                except AttributeError:
                    try:
                        # Try get_tables() method (older versions or different library)
                        table_list = page.get_tables()
                    except AttributeError:
                        # If neither method exists, skip table extraction
                        logger.info(f"Table extraction not available for page {page_num + 1}")
                        continue
                
                for table_idx, table in enumerate(table_list):
                    try:
                        # Handle different table object types
                        if hasattr(table, 'extract'):
                            table_data_raw = table.extract()
                        else:
                            table_data_raw = table
                        
                        table_data = {
                            "page": page_num + 1,
                            "table_index": table_idx,
                            "rows": len(table_data_raw) if table_data_raw else 0,
                            "columns": len(table_data_raw[0]) if table_data_raw and table_data_raw[0] else 0,
                            "data": table_data_raw
                        }
                        tables.append(table_data)
                    except Exception as table_error:
                        logger.warning(f"Error processing table {table_idx} on page {page_num + 1}: {str(table_error)}")
                        continue
                    
            except Exception as e:
                logger.warning(f"Error extracting tables from page {page_num + 1}: {str(e)}")
                continue
        
        return tables
    
    def _extract_figures(self, doc, file_path: str) -> List[Dict[str, Any]]:
        """Extract figure information from the PDF and save images to disk for frontend display.

        Heuristics:
        - Save embedded images per page
        - Build a simple caption index using page text blocks
        - Try to detect labels like "Figure 1.3" or "Fig. 2"
        """
        

        figures: List[Dict[str, Any]] = []
        pdf_path = pathlib.Path(file_path)
        stem = pdf_path.stem

        # Directory to store extracted assets: uploads/<stem>/figures
        upload_dir = pathlib.Path(settings.upload_dir)
        asset_dir = upload_dir / stem / "figures"
        asset_dir.mkdir(parents=True, exist_ok=True)

        figure_label_re = re.compile(r"\bfig(?:ure)?\.?\s*\d+(?:\.\d+)*", re.IGNORECASE)

        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                # Get all images with full data to access xref
                image_list = page.get_images(full=True)

                # Attempt to find figure captions on the page (use blocks to preserve local grouping)
                caption_candidates: List[str] = []
                blocks = page.get_text("blocks") or []
                for b in blocks:
                    try:
                        text = (b[4] if len(b) > 4 else "") or ""
                        if not text:
                            continue
                        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
                        for ln in lines:
                            if ln.lower().startswith("figure") or ln.lower().startswith("fig ") or ln.lower().startswith("fig."):
                                caption_candidates.append(ln)
                    except Exception:
                        continue

                for img_idx, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        # Save as PNG
                        file_name = f"page{page_num+1}_img{img_idx+1}.png"
                        file_path_out = asset_dir / file_name
                        if pix.n - pix.alpha >= 4:  # CMYK: convert to RGB
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        pix.save(str(file_path_out))
                        pix = None

                        web_path = f"/uploads/{stem}/figures/{file_name}"

                        # Extract first label match from any candidate
                        label = None
                        for cap in caption_candidates:
                            m = figure_label_re.search(cap)
                            if m:
                                label = m.group(0)
                                break

                        figure_data = {
                            "page": page_num + 1,
                            "image_index": img_idx + 1,
                            "xref": xref,
                            "width": img[2],
                            "height": img[3],
                            "path": str(file_path_out),
                            "url": web_path,
                            "captions": caption_candidates,
                            "label": label,
                        }
                        figures.append(figure_data)
                    except Exception as img_err:
                        logger.warning(f"Error saving image {img_idx} on page {page_num + 1}: {img_err}")
                        continue
            except Exception as e:
                logger.warning(f"Error extracting figures from page {page_num + 1}: {str(e)}")
                continue

        return figures
    
    def _create_documents(self, text_content: str, metadata: Dict[str, Any]) -> List[Document]:
        """Create LangChain Document objects from the extracted text"""
        from app.config import settings
        
        # Split text into chunks
        chunks = self._split_text_into_chunks(text_content, settings.chunk_size, settings.chunk_overlap)
        
        documents = []
        for i, chunk in enumerate(chunks):
            doc = Document(
                page_content=chunk,
                metadata={
                    **metadata,
                    "chunk_index": i,
                    "chunk_size": len(chunk),
                    "source": metadata.get("title", "Unknown")
                }
            )
            documents.append(doc)
        
        return documents
    
    def _split_text_into_chunks(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # If this isn't the last chunk, try to break at a sentence boundary
            if end < len(text):
                # Look for sentence endings near the end
                for i in range(end, max(start, end - 100), -1):
                    if text[i] in '.!?':
                        end = i + 1
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position for next chunk
            start = end - chunk_overlap
            if start >= len(text):
                break
        
        return chunks
    
    def analyze(self, documents: List[Document], query: Optional[str] = None) -> Dict[str, Any]:
        """
        This agent's primary role is content extraction, not analysis
        """
        return {
            "agent": self.name,
            "message": "PDF Parser Agent completed content extraction",
            "documents_processed": len(documents),
            "status": "extraction_complete"
        }
