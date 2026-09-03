---
name: touhou-pet
description: >-
  Comprehensive guide and operations manual for the Touhou Desktop Pet (东方桌宠) system.
  Use this skill whenever working on, interacting with, testing, or developing the Touhou Desk Pet:
  including character creation/customization, LangGraph ReAct state machine, Live2D rendering,
  dynamic DataBank tables, application launcher whitelist configuration, DSH agent integration,
  and MCP server operations.
---

# Touhou Desktop Pet (东方桌宠) 专家技能手册

本技能为东方桌宠系统的标准架构认知、功能开发与智能交互全景指南。系统基于 **Electron + FastAPI + LangGraph ReAct 状态机 + Live2D + DeepSeek Harness (DSH)** 构建，支持多角色即时切换与动态数据库记忆。

---

## 目录索引

- [核心架构与运行机制](./references/architecture.md)：FastAPI 路由拓扑、LangGraph 条件边调度与生命周期
- [应用启动白名单与工具箱体系](./references/tools_and_app_launcher.md)：【重点】应用启动白名单配置与工具执行规范
- [多角色系统与人设规范](./references/character_system.md)：角色目录结构、Prompt 设计、立绘与日记系统
- [动态数据库 (DataBank) 指南](./references/databank_guide.md)：数据表 Schema、异步提炼与更新指令语法

---

## 快速工作流与常见开发任务

### 1. 查阅与配置「应用启动白名单 (app_launcher)」
应用启动白名单允许用户在日常对话中指示桌宠打开本地软件（如“打开网易云音乐”、“帮我打开VSCode”）。
* **配置存储**：`services/global_config.json` 中的 `"app_launcher"` 字典，格式为 `{"别名/唤醒词": "程序可执行文件绝对路径"}`。
* **修改与持久化**：
  - **方法 A (MCP 工具)**：调用 `desk_pet_get_app_launcher_whitelist` 与 `desk_pet_update_app_launcher_whitelist`；
  - **方法 B (HTTP API)**：向 `POST /api/settings/config` 提交 `{"app_launcher": {...}}`；
  - **方法 C (控制台前端)**：在控制台「工具设置」卡片中点击「应用启动白名单」弹窗进行可视化维护。
* **执行节点**：详见 [`tools_and_app_launcher.md`](./references/tools_and_app_launcher.md)。

### 2. 通过 MCP Server 与桌宠实时交互
项目配备标准 MCP Stdio 服务 [`services/mcp_server.py`](file:///g:/code/rumia/services/mcp_server.py)，向外部智能体暴露以下核心能力：
* `desk_pet_status`：查询当前活跃角色、好感度、心情与实时活动；
* `desk_pet_chat`：向桌宠发送消息，同时获取其内心思考 (`<character_thought>`) 与前台对白；
* `desk_pet_switch_character`：快速切换当前活跃角色（如 `flandre`, `rumia`, `mystia`, `koishi`, `lily`, `wriggle`）；
* `desk_pet_query_databank`：查询角色的动态记忆与数据表格；
* `desk_pet_get_app_launcher_whitelist` & `desk_pet_update_app_launcher_whitelist`：管理应用白名单；
* `desk_pet_trigger_agent`：远程调度 DSH 智能体执行代码或系统任务，自动注入角色人设与近期语境。

### 3. 多角色开发与人设维护
所有角色统一位于 `services/characters/<char_id>/`：
* `config.json`：包含 `character_id`、`character_name`、`persona_prompt`（人设）、`user_prompt`（对用户的称谓）；
* `presets.json`：条件触发词与常驻提示词；
* `databank_template.json`：该角色的动态数据库初始化骨架；
* 立绘与动作位于根目录下的 `characters/<char_id>/`（Live2D 或 PNG 序列帧）。

### 4. DSH 智能体工程调度与人设信封
* 触发规则：用户输入中包含或以 **`启动agent`** 开头；
* 运行模式：常态启动（同生共死守护进程） vs 触发启动（无头即用即退）；
* 人设信封同步：[`tool_executor.py`](file:///g:/code/rumia/services/tools/tool_executor.py) 会在每次执行前将当前角色姓名、人设片段与最近几轮对话打包注入，确保智能体以角色第一人称视角输出。

---

## 质量保障与安全红线

1. **个人数据保护（最高禁令）**：绝不将用户的历史数据文件（如 `data/`、`services/global_config.json` 中的私有 API Key、`dialog_history_*.json`）提交至版本库；
2. **安全删除原则**：删除任何用户数据必须送入 Windows 回收站，禁止直接调用 `rm -rf` 或 `Remove-Item`；
3. **版本控制政策 (SemVer)**：
   - MAJOR：仅限用户明确指示；
   - MINOR：经由确认的全新功能模块；
   - PATCH：日常迭代、缺陷修复与微调。
   - 每次提交必须附带统一协作者签名：`Co-authored-by: Antigravity <antigravity-bot@users.noreply.github.com>`。
