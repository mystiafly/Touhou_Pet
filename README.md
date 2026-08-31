# 🌟 Rumia Desktop Pet - 次世代 AI 虚拟伴侣引擎

这是一个基于 **Agent 级别 LangGraph 框架**、**Qdrant 向量数据库**，并采用前端 **Electron + HTML/JS** 渲染的工业级高级 AI 桌面宠物项目。

相比传统的桌面宠物，本项目的核心突破在于它是一个真正的 **Agent**，拥有极其自由的模型控制权、深度动态记忆以及对本地环境的操作能力。你的桌宠不再是简单的按键反馈器，而是一个拥有长记忆、懂你喜好、并且可以连接任何最强大脑、使用多种工具的“赛博生命”。

---

## 🔥 核心特性 (Core Features)

### 1. 🕸️ Agent 级别的 LangGraph 框架 AI 桌宠
底层架构不再是简单的“一问一答”，而是引入了行业前沿的 LangGraph 状态机框架！
- **分层大脑处理引擎**：采用 Pre-LLM（意图解析与拦截）、Main-LLM（对话核心）、Post-LLM（后置处理）等多模态路由层。
- **让模型各司其职**：主聊天模型不再背负解析复杂后台指令的包袱，专注提供最有灵魂的文字对话；工具拦截前置化，使得对话与动作的逻辑无比流畅。

### 2. 🧠 完全由你配置的大模型接口 (Custom Brain Engine)
拒绝被官方 API 绑定！内置了高度自由的 LLM 引擎管理器：
- **本地与开源生态支持**：完美支持 Ollama、vLLM 本地运行，也支持 DeepSeek、Kimi、硅基流动 (SiliconFlow)、智谱、通义千问等所有兼容 OpenAI 格式的第三方接口。数据 100% 留存在本地，极致隐私安全，适合高强度 RP（角色扮演）。
- **一键智能拉取**：内置一键拉取模型列表功能，自动检测代理服务器可用的模型，告别手动查文档配参数的痛苦。

### 3. 🎭 高度自定义桌宠（初始5个东方角色）
- 瞬间在不同角色之间切换。默认内置了 5 位性格各异的东方 Project 初始角色（露米娅、莉莉白、米斯蒂娅、莉格露、琪露诺）。
- 不仅桌宠的透明立绘、UI 主题色调会无缝变化，**底层的 AI 大脑人格、好感度系统和记忆存档也完全物理隔离！**
- **轻松孕育新灵魂**：在控制台中可一键生成新角色配置，仅需准备对应的透明底图，即可让你的本命角色降临桌面。

### 4. 🛠️ 强大工具调用能力（正在持续更新）
脱离纯文本交互，直接让桌宠成为你的系统管家！
- **工具调用前置化架构**：内置了强大的指令系统。目前已实现诸如“一键内存静默清理”等实用工具，执行完清理任务后，桌宠会携带着精确的内存释放数据向你撒娇邀功。
- **无限扩展空间**：底层支持不断加入全新的操作本地电脑、读取文件、定时提醒的各类工具插件。

### 5. 📚 动态数据库构建的真正长期记忆
你的桌宠不仅会和你聊天，还会**在深夜写日记**并深深记住关于你的一切。
- **双轨制大脑引擎**：采用 Qdrant 向量数据库，构建了一个拥有短期工作记忆（缓存）与长期深度记忆（节点化图谱）的双层记忆架构。
- **夜间自动批处理 & 数据银行 (DataBank)**：桌宠会定期总结你们的对话，生成带有傲娇/呆萌等性格色彩的专属回忆日记，并通过 RAG (检索增强生成) 在未来的对话中向你提起以前的事。

### 6. 📖 支持酒馆世界书兼容的高度可配置预设
如果你是从 SillyTavern（酒馆）转来的硬核玩家，这里将是你的新家。
- **全面兼容与扩展**：支持直接在前端界面导入 Tavern `*.json` 世界书文件。
- **动态预设引擎**：采用递归链式触发，精准提取环境上下文或特定词汇。桌宠在与你聊天时，会自动从数据库中调取相关的世界设定，绝不“出戏”。
- **精细化把控上下文**：支持自定义触发深度，把控 LLM 上下文注入窗口，让角色扮演栩栩如生。

---

## 🚀 快速开始 (Quick Start)

### 环境依赖
- **Python 3.10+**
- **Node.js 18+** 

### 启动步骤
支持小白“一键启动脚本”，直接双击根目录的 `start.bat`，即可全自动安装所有 Python 与前端 Node 环境并自动唤醒大贤者！
或者手动运行：
1. **安装环境**
   ```bash
   pip install -r requirements.txt
   npm install
   ```
2. **启动引擎**
   ```bash
   npm start
   ```

启动后，右键点击桌面上的宠物，选择 **“打开设置控制台 (Dashboard)”**，在“自定义大脑引擎”中填入你的 API Key 或本地模型地址，即可让灵魂苏醒！

---

## 🔮 未来展望

**前端元素更加灵活生动：**
未来我们将进一步打破僵硬的 2D 平面限制，引入更平滑的微动画系统、丰富的交互式微动作反馈机制。不仅仅是立绘差分，还计划在气泡 UI、表情气泡和动作系统中加入大量生动有趣的交互玩法，让她不仅仅是一个 AI 助理，而是真正栩栩如生的屏幕精灵！

---

## Star History

<a href="https://www.star-history.com/?type=date&repos=mystiafly%2FTouhou_Pet">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=mystiafly/Touhou_Pet&type=date&theme=dark&legend=top-left&sealed_token=XSBTu-06HGN34OPAHBNbsuTQlBnXRNP14KB4o8r-VlzbuTTpO8SbsaYX9Ozqp9iK9xj9-_FBfM9Bh6MaBvk_aTAos1H8GT5IRWK1z9Ldf_qSMjb9YUC9zg" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=mystiafly/Touhou_Pet&type=date&legend=top-left&sealed_token=XSBTu-06HGN34OPAHBNbsuTQlBnXRNP14KB4o8r-VlzbuTTpO8SbsaYX9Ozqp9iK9xj9-_FBfM9Bh6MaBvk_aTAos1H8GT5IRWK1z9Ldf_qSMjb9YUC9zg" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=mystiafly/Touhou_Pet&type=date&legend=top-left&sealed_token=XSBTu-06HGN34OPAHBNbsuTQlBnXRNP14KB4o8r-VlzbuTTpO8SbsaYX9Ozqp9iK9xj9-_FBfM9Bh6MaBvk_aTAos1H8GT5IRWK1z9Ldf_qSMjb9YUC9zg" />
 </picture>
</a>

---

## 📄 许可证 (License)
MIT License. 自由地修改、打包和分享属于你自己的桌面伴侣吧！
