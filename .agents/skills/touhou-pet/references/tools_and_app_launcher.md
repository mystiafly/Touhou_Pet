# 东方桌宠工具箱体系与「应用启动白名单」全生命周期指南

东方桌宠内置了丰富的工具调用能力（ReAct 架构），包括应用启动器、屏幕视觉识别、网络检索、天气查询以及 DSH 深度智能体。其中，**应用启动白名单 (Application Launcher Whitelist)** 是桌宠与用户 Windows 本地系统安全联动的重要桥梁。

---

## 一、应用启动白名单运行机制

### 1. 核心设计原则：严格白名单机制
为了保证系统的安全性，桌宠**绝不**允许大模型直接任意执行未经授权的系统命令。所有桌宠能够唤醒的本地应用程序，必须事先登记在配置中心的白名单映射表中。

### 2. 数据流转与前置 Prompt 动态注入
1. **前置感知节点**：在 [`services/graph/nodes.py`](file:///g:/code/rumia/services/graph/nodes.py) 的 `build_pre_messages` 阶段，系统自动从配置中心读取 `app_launcher`：
   ```python
   app_launcher = config_data.get("app_launcher", {})
   available_apps_str = ", ".join(app_launcher.keys()) if app_launcher else "（尚未配置任何本地应用启动项）"
   ```
2. **模型指令注入**：将可用的应用别名列表注入到系统 Prompt 中，提示前置模型：
   > *当用户明确表达想要打开或启动某个本地程序时，如果该程序存在于【受信任本地应用白名单】中，你必须且只能在回复中输出命令标签：`[LAUNCH_APP: 应用名称]`。*
3. **意图正则提取**：在 `parse_pre_response_node` 节点通过正则 `r'\[LAUNCH_APP:\s*(.*?)\]'` 捕获任务。
4. **执行节点与物理校验**：在 [`services/tools/tool_executor.py`](file:///g:/code/rumia/services/tools/tool_executor.py) 的 `execute_launcher_task_node`：
   - 模糊查找匹配别名（不区分大小写）；
   - 检验路径是否为本地有效绝对路径（`os.path.exists`）；
   - 调用 Windows 原生 `os.startfile(matched_path)` 安全启动程序，免去 cmd 窗口弹窗；
   - 将启动成功或失败的结果写回 `launcher_result`，供桌宠以生动的角色对白向用户汇报。

---

## 二、应用启动白名单的数据结构与存储规范

白名单以简单的键值映射存储在 `services/global_config.json` 的 `"app_launcher"` 字段中：

```json
{
  "app_launcher": {
    "微信": "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
    "网易云音乐": "D:\\CloudMusic\\cloudmusic.exe",
    "VSCode": "C:\\Users\\27218\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
    "Steam": "D:\\Steam\\steam.exe",
    "FlClash": "D:\\FlClash\\FlClash.exe"
  }
}
```

### 字段规范：
* **Key (唤醒别名)**：用户平时自然对话中习惯叫的名字。建议简短清晰，如 `"微信"`、`"VSCode"`、`"浏览器"`、`"网易云"`；一个程序可以登记多个别名以便匹配。
* **Value (绝对路径)**：目标可执行文件 (`.exe`) 的物理绝对路径。在 Windows 格式下反斜杠需转义为 `\\` 或使用标准正斜杠 `/`。

---

## 三、白名单的增删改查操作指南

### 途径 1：通过 MCP Server 工具直接维护（推荐外部 Agent 使用）
在 Antigravity、Claude Desktop 或任何 MCP 客户端中，可直接调用：
* **查询白名单**：调用 `desk_pet_get_app_launcher_whitelist`，返回全部已登记别名、路径以及物理文件是否存在状态；
* **更新白名单**：调用 `desk_pet_update_app_launcher_whitelist`，传入新的完整映射字典，配置即刻落盘并热生效；
* **测试启动**：调用 `desk_pet_launch_app`，传入应用别名（如 `"VSCode"`），即可立即拉起该程序。

### 途径 2：通过 HTTP RESTful API 进行维护
向桌宠后台提交 POST 请求：
```http
POST http://127.0.0.1:5000/api/settings/config
Content-Type: application/json

{
  "app_launcher": {
    "微信": "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
    "VSCode": "C:\\Users\\27218\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe"
  }
}
```

### 途径 3：在大贤者控制台界面维护
1. 打开桌宠大贤者控制台 (`http://127.0.0.1:5000/dashboard` 或托盘菜单进入)；
2. 点击左侧导航栏「🛠️ 工具设置/预览」；
3. 点击「应用启动器」卡片；
4. 在弹出的「本地应用启动白名单配置」对话框中，输入别名和程序路径，点击「添加」并保存即可。

---

## 四、安全与异常排查清单

1. **桌宠提示“未找到该应用的启动配置”**：
   - 检查用户对话中的词汇是否与白名单中的别名匹配（大小写或同义词）；
   - 可直接通过 MCP 工具补充该同义别名。
2. **桌宠提示“物理路径不存在”**：
   - 检查所填写的路径是否正确指向了可执行文件，避免将快捷方式指向丢失的路径登记进去。
3. **桌宠没有触发启动而是闲聊回复**：
   - 检查前置大模型是否准确理解了启动指令；
   - 确认 `global_config.json` 中的 `app_launcher` 非空。
