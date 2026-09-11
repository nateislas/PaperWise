# Migration Track: Fast Local Parsing with LiteParse ⚡📄

> **Branch**: `feature/liteparse-integration`  
> **Source Repo**: [run-llama/liteparse](https://github.com/run-llama/liteparse)  
> **Status**: 📋 Planning  
> **Replaces**: Cloud-dependent LlamaParse + basic PyMuPDF text scraping  
> **Target Latency**: `< 500ms` per document (down from 15–30s)

---

## 1. Executive Summary

PaperWise previously relied on **LlamaParse** (a cloud service requiring API keys and network round-trips) with a rudimentary **PyMuPDF (`fitz`)** fallback. As observed in production, this created:
- **Cloud Latency & Timeouts**: 15–30 second latency per paper, occasional TLS handshake / `ConnectError` cloud network stalls leaving the UI waiting at 0%.
- **Cost Accumulation**: Every PDF parsed incurs a paid API transaction.
- **Privacy Constraints**: Sensitive/unpublished manuscripts had to be transmitted to third-party cloud infrastructure.
- **Format Inconsistency**: PyMuPDF fallback lost table grid structures, multi-column reading orders, and formatting.

**LiteParse** is LlamaIndex's standalone, open-source document parser written in **Rust** (using the Google Chrome PDFium engine under the hood) with native Python bindings (`liteparse` on PyPI). It provides:
1. **100% Local & Model-Free**: Zero cloud dependencies, zero external network requests, zero API token costs.
2. **Blazing Speed**: Parsed the 15-page *Attention Is All You Need* paper in **330 milliseconds** (a **~50x to 100x speedup** over cloud parsing).
3. **Structured Markdown with Tables**: Automatically reconstructs spatial grid layouts into clean GitHub-flavored Markdown tables and section hierarchies.
4. **Intelligent Complexity Detection**: Can probe a document up front to detect whether it is born-digital or scanned, avoiding unnecessary OCR costs.
5. **Built-in Screenshot & Figure Capabilities**: Native PDF rendering for multimodal workflows and UI previews.

---

## 2. Benchmark Comparison (Measured on PaperWise)

Testing conducted locally on `1706.03762 (Attention Is All You Need.pdf - 15 pages)`:

| Metric | LlamaParse (Cloud) | PyMuPDF (Legacy Fitz) | LiteParse (Target) |
| :--- | :--- | :--- | :--- |
| **Execution Mode** | Remote API (Cloud) | Local Python | **Local Rust/PDFium** |
| **Parsing Time** | 15,000 – 30,000 ms | ~1,200 ms | **330 ms** (⚡ ~50x faster) |
| **Network Required** | Yes (Cloud API key) | No | **No (Air-gapped safe)** |
| **API Cost** | Per-page billing ($) | Free | **Free / Open Source** |
| **Table Quality** | High (Cloud LLM) | Low (Fragmented lines) | **High (Spatial Grid Projection)** |
| **Multi-Column Order** | Good | Fair (Heuristic) | **Accurate (PDFium Layout Engine)** |
| **OCR Support** | Cloud OCR | None | **Selective Tesseract / RapidOCR** |
| **Screenshots / Visuals**| Separate API | Basic Pixmap | **Native Fast PNG Buffers** |

---

## 3. Architecture & Integration Plan

```
                   ┌───────────────────────────────────┐
                   │        PDF Upload Received         │
                   └─────────────────┬─────────────────┘
                                     │
                   ┌─────────────────▼─────────────────┐
                   │    LiteParse Pre-Flight Check     │
                   │   • Format Detection              │
                   │   • Scanned vs Born-Digital Check │
                   └─────────────────┬─────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
         Born-Digital (95% of papers)       Scanned / Low Confidence
                    │                                 │
     ┌──────────────▼─────────────┐     ┌─────────────▼─────────────┐
     │  LiteParse (No OCR)        │     │  LiteParse + Tesseract    │
     │  • PDFium Spatial Layout   │     │  • Native Text Extraction │
     │  • Table Reconstruction    │     │  • Selective OCR Overlay  │
     │  • Latency: ~200-400ms     │     │  • Latency: ~3-8s         │
     └──────────────┬─────────────┘     └─────────────┬─────────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     │
                   ┌─────────────────▼─────────────────┐
                   │      Unified Output Generator     │
                   │   • LLM-Ready Clean Markdown      │
                   │   • Extracted High-Res Figures    │
                   │   • Structured Table Arrays       │
                   │   • Page-Indexed Document Chunks  │
                   └─────────────────┬─────────────────┘
                                     │
                   ┌─────────────────▼─────────────────┐
                   │ LangGraph Multi-Round Debate Node │
                   └───────────────────────────────────┘
```

---

## 4. Detailed Component Changes

### 4.1 Dependency Updates
- **`backend/requirements.txt`**:
  - Add: `liteparse>=2.14.4`
  - Optional / Deprecate: Remove hard dependency on cloud `llama-parse` for local execution.
- **`backend/Dockerfile`**:
  - `liteparse` bundles its own pre-compiled Rust/PDFium binaries for Linux ARM64/x86_64, requiring standard libc (already present in `python:3.11-slim`).
  - Add `tesseract-ocr` and `libtesseract-dev` if local scanned OCR is desired inside the container.

### 4.2 Backend Settings (`backend/app/config.py`)
Add configuration toggles:
```python
# LiteParse Configuration
enable_liteparse: bool = True
liteparse_ocr_enabled: bool = True  # True by default: extracts diagram text & labels (9s total vs 30s cloud)
liteparse_image_mode: str = "placeholder"  # "placeholder" | "off" | "embed"
liteparse_extract_links: bool = True
```

### 4.3 PDF Parser Agent Overhaul (`backend/app/agents/pdf_parser_agent.py`)
- Replace the fragile cloud LlamaParse try/except block with native `LiteParse`:
```python
from liteparse import LiteParse

class PDFParserAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="PDF Parser Agent", description="Fast spatial PDF parser powered by LiteParse")
        self.lite_parser = LiteParse(
            output_format="markdown",
            ocr_enabled=settings.liteparse_ocr_enabled,
            extract_links=settings.liteparse_extract_links,
            image_mode=settings.liteparse_image_mode
        )

    def parse_pdf(self, file_path: str) -> Dict[str, Any]:
        # 1. Fast local extraction via LiteParse
        res = self.lite_parser.parse(file_path)
        markdown_text = res.text
        
        # 2. Extract embedded figures / charts using LiteParse screenshots / PyMuPDF
        figures = self._extract_figures(doc, file_path)
        
        # 3. Create document chunks annotated with page numbers
        documents = self._create_documents_from_pages(res.pages, metadata)
        ...
```

### 4.4 LangGraph Parser Node (`backend/app/agents/graph/nodes/parser.py`)
- Update provenance telemetry to report:
  - `engine: "liteparse"`
  - `parse_time_ms`: exact duration from Rust engine
  - `pages_count`: number of pages extracted
  - `ocr_used`: boolean flag indicating if OCR was engaged

---

## 5. Implementation Roadmap

| Phase | Milestone | Description | Est. Effort |
| :---: | :--- | :--- | :---: |
| **1** | **Environment & Package Setup** | Install `liteparse` in `requirements.txt` and verify Docker container build compatibility. | 1 hr |
| **2** | **Core Parser Migration** | Implement `LiteParse` engine inside `PDFParserAgent`, replacing legacy LlamaParse cloud call. | 2 hrs |
| **3** | **Figures & Page Chunking** | Unify page-level chunking (`res.pages`) with metadata and high-resolution figure extraction. | 2 hrs |
| **4** | **Test Suite & Benchmarking** | Create `tests/test_liteparse_parser.py` validating markdown tables, speed (<1s), and chunk fidelity. | 1.5 hrs |
| **5** | **Live Pipeline & UI Verification** | Run live streaming analysis on local PDFs in Docker to confirm instant progress transition. | 1 hr |

---

## 6. Success Metrics & Validation

1. **Extraction Latency**: Average parsing time drops from `> 15s` to `< 1.0s` for standard research papers.
2. **Zero Network Failure Modes**: Parsing succeeds 100% locally even with no internet connection or during cloud service degradation.
3. **Table & Formula Formatting**: High-fidelity markdown tables preserve rows, column headers, and mathematical notation.
4. **Complete Backward Compatibility**: Output schema matches `PaperAnalysisState` so downstream LangGraph expert debate agents and UI components require zero breaking changes.
