# 🤖 PaperWise: Agent & Developer Guide

PaperWise is a high-fidelity AI research assistant designed specifically for PhD students and PIs. It performs deep critical analysis of methodology, novelty, and empirical rigor using a multi-agent LangGraph system.

---

## 🏗️ Architecture Overview

### Backend: LangGraph Multi-Agent System
The backend uses a **Stateful Graph** (`backend/app/agents/graph/`) to manage complex analysis workflows.
- **State Object:** The single source of truth (`state.py`). We use `TypedDict` for the graph state and `Pydantic v2` for structured LLM outputs.
- **Reducers:** Use `Annotated` with `operator.add` for accumulating logs, status updates, and errors.
- **Expert Nodes:** Specialized functions that return **partial state updates** (e.g., `return {"methodology_analysis": "..."}`) rather than mutating state directly.

### Frontend: Soft Modern React
The frontend follows a "Soft Modern" aesthetic (Apple-esque glassmorphism) and uses a streaming-first UI.
- **Data Flow:** Consumes Server-Sent Events (SSE) from the FastAPI backend to provide real-time step-by-step progress.
- **Accessibility:** Strict WCAG Level AA compliance is mandatory.

---

## 🛠️ Critical Commands

| Task | Command |
| :--- | :--- |
| **Start Dev (Docker)** | `./dev.sh` (Enables Hot-Reloading & Polling) |
| **Backend Tests** | `cd backend && pytest` |
| **Frontend Tests** | `cd frontend && npm test` |
| **Linting (Python)** | `ruff check .` or `flake8` |
| **Stop Services** | `docker compose -f docker-compose.yml -f docker-compose.dev.yml down` |

---

## 📏 Engineering Standards

### 🐍 Python (Backend)
- **Framework:** FastAPI (Async-native).
- **LLM Orchestration:** LangChain v0.3+, LangGraph v0.2+.
- **State Management:**
    - Always use `with_structured_output()` for final reports.
    - Avoid global variables; use FastAPI `Depends` for DB/Graph injection.
    - Implement `recursion_limit` (default: 25) to prevent infinite loops.
- **Typing:** Strict type hints. No `Any` unless absolutely unavoidable.

### ⚛️ TypeScript (Frontend)
- **Framework:** React 18 + Tailwind CSS v3.3.3.
- **Naming:** PascalCase for components, camelCase for hooks and utilities.
- **Exports:** Use **Named Exports** only. No `default export`.
- **Styling:** Adhere to `dev_docs/DESIGN_STYLE_GUIDE.md`.

---

## 🚫 Forbidden Patterns (Negative Constraints)

- **❌ No `any`:** Do not bypass the type system in TypeScript or Python.
- **❌ No direct state mutation:** In LangGraph nodes, always return a new dictionary for updates.
- **❌ No legacy CSS:** Do not use `shadow-2xs` or other Tailwind 3.4+ utilities (not supported in current env).
- **❌ No synchronous I/O:** Never use `time.sleep()` or synchronous requests (`requests` library); use `asyncio.sleep()` and `httpx` or `aiohttp`.
- **❌ No hardcoded secrets:** Never commit API keys. Use `.env` and `config.py`.

---

## ✨ Design Principles ("Soft Modern")
- **Glassmorphism:** Use `.glass-panel` (blur + transparency) for persistent UI.
- **Soft Geometry:** `rounded-2xl` for cards, `rounded-xl` for buttons.
- **Accessible Focus:** Every interactive element MUST have the `.focus-ring` utility.
- **Clear Feedback:** Use `aria-live="polite"` for streaming analysis updates.

---

## 🚀 Pro-Tip: Working as an Agent
When working as an AI agent in this repo:
1. **Read the State:** Always check `backend/app/agents/graph/state.py` before modifying nodes.
2. **Surgical Edits:** Use `replace` for targeted changes.
3. **Validate:** Run the relevant test suite after any logic change.
4. **Trace:** If adding a new node, add a corresponding status update to the `status_updates` list in the state so the frontend can display it.
