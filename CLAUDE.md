# CLAUDE.md - AI Coding Assistant Guidelines & Project Manual

Welcome, AI Assistant! This document is your single source of truth for the **Touhou Desktop Pet (Rumia / Mystia / Multi-Character Desk Pet)** project. Read and strictly adhere to all guidelines, architectural patterns, and safety invariants defined below.

---

## 1. Project Overview & Core Architecture

This project is a modern, extensible, multi-character AI desktop pet built with a **dual-process (Frontend Body + Backend Brain)** architecture communicating over high-frequency local HTTP/WebSocket IPC (`http://127.0.0.1:5000`).

```
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND: Body & UI (Electron)              │
│  - main.js (Main Process, Tray, Window Pass-through, DWM)    │
│  - index.html & renderer.js (Sprite 60fps Canvas & Bubble)  │
│  - immersive.html (Starry Wallpapers & Visual Snapshot)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Local HTTP/WS IPC (Port 5000)
┌──────────────────────────────┴──────────────────────────────┐
│                 BACKEND: Brain & Engine (FastAPI)           │
│  - services/main.py (Server Entrypoint, Lifespan & Uvicorn) │
│  - services/api/routes.py (REST API & WebSockets)           │
│  - services/graph/ (LangGraph StateGraph Workflow Nodes)    │
│  - services/core/ (Config, LLM, Mem0 RAG, DataBank, Diary)  │
│  - services/tools/ (App Launcher, Web, 4-Attempt Vision)    │
│  - services/characters/ (Multi-Character Isolation Storage) │
│  - services/templates/ & static/ (Dashboard Control Center) │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Key Dependencies

- **Frontend**: Electron, HTML5 Canvas, Vanilla CSS3, Vanilla JS (No Tailwind, No Heavy Frameworks in pet overlay).
- **Backend Runtime**: Python 3.10+ (compatible with Python 3.10, 3.11, 3.12).
- **Web & API Framework**: FastAPI, Uvicorn, Pydantic, WebSockets.
- **AI Agent Orchestration**: LangGraph (`StateGraph`, `AgentState`), LangChain Core.
- **LLM Integrations**: OpenAI SDK compatible (DeepSeek, VolcEngine Doubao Ark, Gemini, custom endpoints).
- **Memory & RAG**:
  - `Mem0` vector database with **100% offline local embeddings** (`sentence-transformers/all-MiniLM-L6-v2`).
  - `DataBank` structured dynamic profile memory (`databank.json`).
  - Auto-generated daily diary system (`services/core/diary_system.py`).
- **Vision Recognition**: Screen capture with PIL + adaptive 4-attempt resolution downscaling retry strategy (`1024 -> 1024 -> 512 -> 256`).
- **Packaging & Distribution**: `electron-builder` with custom NSIS installer script (`installer.nsh`).

---

## 3. Essential Commands & Development Workflows

### Running & Developing
```bash
# One-click start (Dev Mode - checks environment, python, and deps automatically)
start.bat

# Or run backend & frontend separately:
python services/main.py               # Starts FastAPI backend on 127.0.0.1:5000
npx electron main.js                  # Launches Electron desktop window
```

### Dependency Management
```bash
# Install Python dependencies (using Tsinghua mirror)
python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# Spacy Chinese / English models
pip install https://ghfast.top/https://github.com/explosion/spacy-models/releases/download/zh_core_web_sm-3.8.0/zh_core_web_sm-3.8.0-py3-none-any.whl
```

### Building & Packaging
```bash
# Build standalone installer (.exe)
npm run build
```

---

## 4. Key Architectural Patterns & Conventions

### A. Dual Environment Path Resolution
- In **Source Dev Mode** (`!app.isPackaged` / not frozen):
  - Configs & character data are read from `services/characters/`.
  - Electron debug logs write to `logs/electron_debug.log`.
  - Backend logs write to `services/logs/backend_output.log`.
- In **Packaged Production Mode** (`app.isPackaged` / `sys.frozen`):
  - Configs & user databases write to `%APPDATA%\RumiaDesktopPet\`.
  - Logs write to `%APPDATA%\RumiaDesktopPet\logs\`.
  - `init_user_data_dir()` in `config_manager.py` handles auto-unzipping of defaults.

### B. Prompt Caching & Window Sizing
- LangGraph nodes use dynamic context step windows (`x1, x2, x4, x8`) to maximize LLM API Prompt Cache hit ratios (up to 100% cache hit on DeepSeek / Doubao).
- Real-time timestamps and date headers are dynamically injected without invalidating cached conversation prefixes.

### C. Multi-Character System
- Adding a new character requires configuring:
  1. `services/characters/<char_id>/` (config.json, presets.json, databank.json, diaries/).
  2. `characters/<char_id>/` in frontend root (containing animated GIF/APNG sprite assets).
  3. Registering the character in `config_manager.py` and `dashboard.html`.

---

## 5. Absolute Safety & Privacy Invariants (CRITICAL)

1. **Personal API Keys & Privacy Protection**:
   - **NEVER** commit or push `.env` or files containing real API keys (`sk-...`, `ark-...`) to Git.
   - When staging `services/global_config.json` for Git commits, ensure secret fields are set to `""`.
   - On the developer machine, keep local configuration intact using `git update-index --assume-unchanged services/global_config.json`.
2. **Safe Deletion Policy**:
   - **NEVER** permanently delete user history, diaries, or databanks using `rm -rf`, `del`, or `Remove-Item`.
   - Always move items to the Recycle Bin (Trash) using COM `Shell.Application` or Python `send2trash`.

---

## 6. Semantic Versioning & Git Commit Rules

For **every code modification** that produces a Git commit:

1. **Version Update**: Update `"version"` in `package.json` according to SemVer:
   - **MAJOR**: Incompatible API redesigns. **ONLY** increment when the user explicitly requests it.
   - **MINOR**: Brand-new feature modules that required an approved Implementation Plan.
   - **PATCH**: Routine bugfixes, minor tweaks, UI improvements, and ongoing feature refinements.
2. **Stage & Commit**:
   Stage `package.json` alongside the modified code files.
3. **Commit Signature**:
   **ALWAYS** append the following trailer to all commit messages:
   ```
   Co-authored-by: Antigravity <antigravity-bot@users.noreply.github.com>
   ```
