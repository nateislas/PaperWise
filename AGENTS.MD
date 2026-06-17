# PaperWise Multi-Agent Architecture 🤖📚

PaperWise uses a state-of-the-art **LangGraph** orchestrator and **LlamaIndex** Managed RAG to provide deep, parallelized research analysis.

## 🏗️ Core Architecture: LangGraph Pipeline

The analysis process is structured as a directed acyclic graph (DAG) where specialized nodes perform focused tasks and accumulate state.

### 1. Parsing & Indexing Layer
*   **📄 PDF Parser Node**: Utilizes **LlamaParse** (Agentic Mode) for high-fidelity markdown extraction. Falls back to PyMuPDF for basic text. Always extracts figure PNGs for UI display.
*   **☁️ LlamaCloud Indexer**: Automatically uploads the processed paper to **LlamaCloud Managed RAG**. This offloads compute-heavy indexing and provides a persistent, scalable knowledge base for the chat.

### 2. Analysis Layer (Parallel Processing)
The pipeline "fans out" after classification to run expert analyses simultaneously:
*   **🔬 Methodology Node**: Evaluates experimental design, technical rigor, and reproducibility.
*   **📊 Results Node**: Scrutinizes findings, statistical significance, and baseline fairness.
*   **🌐 Context Node**: Analyzes novelty, research gaps, and field-wide impact.

### 3. Synthesis Layer
*   **🎯 Synthesis Node**: Collects results from all parallel experts and uses **Gemini 2.5 Flash** with **Structured Output** (Pydantic) to generate a consistent, JSON-formatted Analysis Report.

---

## 💬 Knowledge Chat: Deep Agent

The Knowledge Chat tab uses a specialized **LlamaIndex Deep Agent** for interactive document understanding.

### Capabilities:
*   **Managed RAG**: Connects to the LlamaCloud index for high-performance semantic search.
*   **Contextual Memory**: Remembers the entire conversation history and the initial AI analysis results.
*   **Multi-Source Reasoning**: Synthesizes information from the paper's full text, the pre-generated analysis report, and paper metadata.
*   **Verified Citations**: Provides page-level citations for every claim, linking back to the original document.

---

## 🛠️ Technology Stack
*   **Orchestration**: LangGraph
*   **Intelligence**: Google Gemini 2.5 Flash
*   **Data Services**: LlamaIndex & LlamaCloud
*   **Parsing**: LlamaParse (High-res OCR & Agentic Extraction)
*   **Workflow**: Celery + Redis for asynchronous background processing
