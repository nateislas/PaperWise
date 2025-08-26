import fitz  # PyMuPDF
from typing import Dict, List, Any, Optional
from langchain.schema import Document
import logging
import os
from datetime import datetime

from app.agents.base_agent import BaseAgent

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
            
            # Extract figures
            figures = self._extract_figures(doc)
            
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
            return {
                "title": metadata.get("title", "Unknown"),
                "author": metadata.get("author", "Unknown"),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "pages": len(doc),
                "file_size": os.path.getsize(doc.name) if hasattr(doc, 'name') else 0,
                "parsed_at": datetime.now().isoformat()
            }
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
    
    def _extract_tables(self, doc) -> List[Dict[str, Any]]:
        """Extract tables from the PDF"""
        tables = []
        
        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                table_list = page.get_tables()
                
                for table_idx, table in enumerate(table_list):
                    table_data = {
                        "page": page_num + 1,
                        "table_index": table_idx,
                        "rows": len(table),
                        "columns": len(table[0]) if table else 0,
                        "data": table
                    }
                    tables.append(table_data)
                    
            except Exception as e:
                logger.warning(f"Error extracting tables from page {page_num + 1}: {str(e)}")
                continue
        
        return tables
    
    def _extract_figures(self, doc) -> List[Dict[str, Any]]:
        """Extract figure information from the PDF"""
        figures = []
        
        for page_num in range(len(doc)):
            try:
                page = doc.load_page(page_num)
                image_list = page.get_images()
                
                for img_idx, img in enumerate(image_list):
                    figure_data = {
                        "page": page_num + 1,
                        "image_index": img_idx,
                        "bbox": img[0],  # bounding box
                        "width": img[2],
                        "height": img[3]
                    }
                    figures.append(figure_data)
                    
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
