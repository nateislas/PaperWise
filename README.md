# PaperWise - AI Research Paper Analysis Agent

An intelligent AI agent designed to provide deep, critical analysis of research papers, going beyond simple summarization to offer the kind of insights a PhD student or Principal Investigator would seek.

## 🎯 Purpose

PaperWise helps researchers understand:
- **The "What" and "Why"**: Problem statements, hypotheses, and motivations
- **The "How"**: Methodology, experimental design, and novelty
- **The "Results and Impact"**: Key findings, interpretations, and limitations
- **The "So What"**: Contribution to the field and relevance to your work

## 🚀 What PaperWise Does

Your AI agent system provides:

- **Deep Analysis**: Go beyond simple summarization to provide critical evaluation
- **Multi-Agent Collaboration**: Specialized agents work together for comprehensive analysis
- **Research-Focused**: Designed for PhD students and PIs with specific research questions
- **Interactive Queries**: Ask specific questions about methodology, results, or implications
- **Structured Output**: Clear, organized analysis with actionable insights

The system is ready to analyze research papers with the depth and insight that researchers need! 🚀

## 🏗️ Architecture

### Frontend
- Modern React application with drag-and-drop file upload
- Clean, intuitive interface for paper analysis
- Real-time analysis progress tracking

### Backend
- Multi-agent system using Python and LangChain
- Specialized agents for different analysis tasks:
  - **PDF Parser Agent**: Extracts text, tables, and figures
  - **Methodology Agent**: Analyzes experimental design and methods
  - **Results Agent**: Interprets findings and statistical significance
  - **Contextualization Agent**: Compares with existing literature
  - **Orchestrator Agent**: Coordinates and synthesizes all analyses

## 🚀 Features

- **Deep Analysis**: Critical evaluation of methodology, results, and implications
- **Contextual Understanding**: Cross-references with relevant literature
- **Interactive Queries**: Ask specific questions about any aspect of the paper
- **Structured Output**: Clear, organized analysis with actionable insights
- **Multi-format Support**: PDF parsing with table and figure extraction

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, LangChain
- **AI/ML**: Meta Llama models, Vector databases
- **Document Processing**: PyMuPDF, LangChain document loaders
- **Package Management**: uv (fast Python package manager)
- **Deployment**: Docker, Cloud-ready

## 📋 Getting Started

1. Clone the repository
2. Install dependencies (see installation guide)
3. Set up environment variables (LLAMA_API_KEY)
4. Run the development server
5. Upload a research paper and start analyzing!

### Quick Start

```bash
# Start both backend and frontend
./start-paperwise.sh

# Or start individually:
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm start
```

## 📖 Documentation

See the `/docs` folder for detailed setup and usage instructions.