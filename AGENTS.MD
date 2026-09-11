# PaperWise Multi-Agent Architecture 🤖📚

PaperWise uses a state-of-the-art **LangGraph** orchestrator and a self-contained **LangGraph ReAct Deep Agent** to provide deep, parallelized research analysis and interactive knowledge exploration.

## 🏗️ Core Architecture: LangGraph Pipeline

The analysis process is structured as a directed acyclic graph (DAG) where specialized nodes perform focused tasks and accumulate state.

### 1. Parsing & Indexing Layer
*   **📄 PDF Parser Node**: Utilizes **LiteParse** (Local Rust/PDFium engine with Tesseract OCR) for high-fidelity markdown extraction, spatial tables, and diagram understanding. Falls back to PyMuPDF for basic text. Extracts high-resolution figure PNGs for UI display.
*   **💾 Local Artifact Persistence**: Stores parsed Markdown chunks, tables, figures, and metadata directly in `analyses/{analysis_id}/parsed_content.json`, providing a 100% self-contained knowledge base for instant chat.

### 2. Analysis Layer (Parallel Processing)
The pipeline "fans out" after classification to run expert analyses simultaneously:
*   **🔬 Methodology Node**: Evaluates experimental design, technical rigor, and reproducibility.
*   **📊 Results Node**: Scrutinizes findings, statistical significance, and baseline fairness.
*   **🌐 Context Node**: Analyzes novelty, research gaps, and field-wide impact.
*   **🔄 Multi-Round Debate Sync**: Synchronizes expert drafts for cross-peer critique and revisions.

### 3. Synthesis Layer
*   **🎯 Synthesis Node**: Collects results from all parallel experts and uses **Gemini 3.5 Flash** with **Structured Output** (Pydantic) to generate a consistent, JSON-formatted Analysis Report.

---

## 💬 Knowledge Chat: LangGraph Deep Agent

The Knowledge Chat tab uses a specialized **LangGraph ReAct Deep Agent** for interactive document understanding.

### Capabilities:
*   **Multi-Source Reasoning**: Dynamically consults paper text chunks, the pre-computed peer review analysis report, extracted Markdown tables, and paper metadata.
*   **Verified Citations**: Provides page-level citations (`[Page X]`) for every claim, linking directly to the embedded PDF viewer.
*   **Contextual Memory**: Retains conversation history and user highlights.
*   **100% Self-Contained**: Operates locally without external cloud index dependencies.

---

## 🛠️ Technology Stack
*   **Orchestration**: LangGraph
*   **Intelligence**: Google Gemini 3.5 Flash (default temperature: 1.0)
*   **Parsing**: LiteParse (Local Rust/PDFium Engine + OCR)
*   **Workflow**: Celery + Redis for asynchronous background processing
