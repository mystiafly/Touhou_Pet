# Changelog (更新日志)

All notable changes to the Rumia Desk Pet project will be documented in this file.
The project adheres to Semantic Versioning (SemVer) with custom rules:
- **MAJOR**: Breaking changes (only bumped when requested by the user).
- **MINOR**: Backward-compatible new features.
- **PATCH**: Backward-compatible bug fixes and minor documentation/config updates.

---

## [0.1.3] - 2026-06-26

### Added
- Created this consolidated `CHANGELOG.md` at the project root to track version updates.

---

## [0.1.2] - 2026-06-26

### Changed
- Synchronized distilled dates list in `services/config.json` after background memory distillation.

---

## [0.1.1] - 2026-06-26

### Added
- Established project-scoped SemVer rules in `.agents/AGENTS.md` to enforce version bumps on every commit.

---

## [0.1.0] - 2026-06-26

### Added
- **Initial Version Release**: Established `0.1.0` as the baseline version.
- **Cross-Drive Migration**: Successfully migrated the entire project from C: drive to `G:\code\rumia` with full Git history and rebuilt Python/Node dependency environments.
- **Daily Diary System (露米娅的日记)**: Implemented an LLM-powered tsundere diary generator and a glassmorphic sub-tab UI in System Settings to isolate diary text and chat history.
- **Attention Priority System (方案 A)**: Implemented P0 tail injection for memory retrieval and P0 isolation for active speaking to prevent dialog repetition and self-answering.
- **Chinese spaCy NLP Integration**: Configured local Chinese entity extraction and linking for the Mem0 physics-based memory graph.
- **Windows Console Crash Fix**: Resolved `UnicodeEncodeError` crashes on Windows GBK consoles by reconfiguring `sys.stdout`/`sys.stderr` to write in UTF-8.
