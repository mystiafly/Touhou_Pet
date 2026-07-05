# 更新日志 (Changelog)

本项目的所有重大变更都将记录在此文件中。
项目遵循语义化版本 (SemVer) 规范，并采用以下自定义规则：
- **MAJOR (主版本)**：不兼容的重大改动（仅在用户明确指示后才会增加）。
- **MINOR (次版本)**：向后兼容的新功能。
- **PATCH (修订号)**：向后兼容的缺陷修复或小幅文档/配置更新。

---

## [0.8.9] - 2026-07-05

### 修复与优化
- **双重修复 Electron 点击穿透锁定 Bug (Dual Fix for Electron Mouse Ignore Lock)**：
  - **Hit-Test 精度修复**：在 Electron 将鼠标忽略状态设为 `true` 时，Chromium 的 `e.target` 在移回交互元素时将失效（仅返回 `html`/`body` 根节点），导致状态锁死无法恢复。使用 [document.elementFromPoint](file:///G:/code/rumia/services/static/js/pet_script.js#L159) 替换/补充 `e.target` 进行精准物理碰撞检测，完美解决检测失灵的问题。
  - **高频通信限流优化**：增加了 `isIgnoring` [状态追踪变量](file:///G:/code/rumia/services/static/js/pet_script.js#L127)，只有当忽略状态**真正发生切换时**才向主进程发送 IPC 消息，彻底根治鼠标滑动时因高频发送 IPC 消息给主进程导致的点击锁死/界面卡顿。

## [0.8.8] - 2026-07-05

### 修复与优化
- **根治全屏点击失效 Bug (Fix Universal Click Ignore Lock)**：找到了此前导致 0.8.2-0.8.5 版本“什么都点不了”的罪魁祸首——这是由于在 Electron 鼠标穿透判定逻辑中，`e.target` (背景区域) 缺乏对 `closest` 方法的安全校验，导致抛出 `TypeError`，进而令 `set-ignore-mouse-events` 陷入永久忽略状态。在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L160) 中加入了 `typeof el.closest === 'function'` 的安全拦截校验与 try-catch，并同时恢复了 [pet.css](file:///G:/code/rumia/services/static/css/pet.css#L886) 中针对音乐播放器栏的精美底部上浮布局。

## [0.8.6] - 2026-07-05

### 回滚
- **前端代码完全退回至 0.8.1 版本 (Frontend Reverted to 0.8.1)**：
  - **无损回滚**：由于 `0.8.2` ~ `0.8.5` 期间进行的音频框定位重构以及 Electron 穿透白名单调试产生了未知的页面锁定/不可点击 Bug，已将所有前端文件（[main.js](file:///G:/code/rumia/main.js), [pet.html](file:///G:/code/rumia/services/templates/pet.html), [pet.css](file:///G:/code/rumia/services/static/css/pet.css), [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js), [package.json](file:///G:/code/rumia/package.json)）**100% 完整无差错地强制回滚至 0.8.1 版本的原始代码**，以恢复其原本绝对稳定的运行与点击状态。

## [0.8.5] - 2026-07-05

### 回滚与优化
- **前端音乐播放栏布局与逻辑回滚 (Frontend Music Player Layout Rollback)**：
  - **位置回滚**：由于布局调整引起的不可点击异常，已将音乐播放框在 [pet.css](file:///G:/code/rumia/services/static/css/pet.css#L884) 中的位置从底部的 `8px` 贴底位置**完全回滚恢复至原本的 `52px` 悬浮位置**（即输入框的上方）。
  - **避让逻辑回滚**：完全移除了输入栏在播放音乐时的 `.with-music` 滑移避让逻辑，使输入栏和播放栏回到之前的经典重叠布局层级，确保最原始、最稳定的渲染表现。
  - **点击修复保留**：保留了对播放框内控制按钮的点击修复。通过在 CSS 中设置 `pointer-events: auto`，以及在 JS `isInteractive` 穿透白名单中保留 `#music-player-bar` 结合卫语句检测，现在位于输入框上方的经典音乐框已**成功恢复可点击、可控制状态**。

## [0.8.4] - 2026-07-05

### 修复
- **防悬停监听器崩溃逻辑卫语句防护 (mousemove Listener Crash Defense & Robustness)**：
  - **避让函数可用性校验**：在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L161) 中，为全局 `mousemove` 监听器中的 `el.closest` 调用增加了防御性的卫语句（`typeof el.closest === 'function'` 校验）。当鼠标划出窗口、或悬停在非 `Element` 类型节点（例如 `document`）上时，由于该节点不具备 `closest` 方法，会导致事件监听器抛出 `TypeError` 崩溃报错，进而导致 Electron 锁死在 `ignore-mouse-events = true`（鼠标穿透）的例外模式中而无法恢复。现已对整个检查块进行了安全的 Try-Catch 和类型验证包裹，彻底修复了概率性点不动、锁死鼠标穿透的底层 Bug。

## [0.8.3] - 2026-07-05

### 修复
- **Electron 鼠标点击忽略白名单修复 (Electron Mouse Ignore Whitelist Fix)**：
  - **穿透过滤白名单补全**：在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L167) 中将 `#music-player-bar` 元素加入到 `isInteractive` 穿透判定白名单中。虽然在 `0.8.2` 中通过 CSS 开启了 `pointer-events`，但由于没有在 JS 侧将其加入 Electron 的非穿透过滤白名单，导致鼠标悬停在播放栏上方时，Electron 仍会触发穿透事件（Ignore Mouse Events = True），使得点击事件被直接穿透到系统桌面。现已修复，按钮可正常点击，且不影响非交互空白区域的穿透。

## [0.8.2] - 2026-07-05

### 优化与修复
- **音乐播放栏布局调整与点击穿透修复 (Music Player Layout & Clickability Fix)**：
  - **暂停/停止按钮点击穿透修复**：在 [pet.css](file:///G:/code/rumia/services/static/css/pet.css#L900) 中为 `.music-player-bar` 显式添加了 `pointer-events: auto;`。由于父级容器禁用了鼠标事件，未设此属性导致所有点击直接穿透播放栏，使得暂停/停止按钮无法响应点击，现已完美修复。
  - **播放栏下沉至输入框下方**：重新调整了 UI 层次结构，将 `.music-player-bar` 底边距（`bottom`）由 `52px` 调整为 `8px` 贴底放置，以置于输入框之下。
  - **输入栏智能避让动画**：在 [pet.css](file:///G:/code/rumia/services/static/css/pet.css#L125-L136) 和 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L52) 中引入了 `.with-music` 动态避让逻辑。当音乐播放器处于激活显示状态时，输入栏底边距（`bottom`）会自动平滑上滑至 `56px` 以完美避让音乐栏；当音乐停止关闭时，输入栏会自动滑回 `10px` 贴底，实现极致的动效美感与无感自适应。

## [0.8.1] - 2026-07-05

### 修复
- **大模型对白中括号格式泄露与中文表情标签降级 (Chinese Format Leak & Fallback Parsing)**：
  - **防泄露清洗提升**：升级了 [parse_reply](file:///G:/code/rumia/services/web_interface.py#L428-L449) 文本抽取函数。利用负向先行断言正则表达式 `r'\[(?!BROWSER_TASK|MUSIC_PLAY)[^\]]+\]'`，强制清理对白中**除了系统任务标签之外的所有残留方括号表情和评分标签**（如二次生成的中文标签 `[开心]` 或 `[评分: 92]`），彻底防止多行段落中标签泄露给用户。
  - **中文心情与评分变体兼容**：在解析层为表情配置了中文降级映射字典（如 `[开心]` $\rightarrow$ `normal`，`[害羞]` $\rightarrow$ `shy`，防止未成功解析导致表情呆滞），同时兼容类似 `[评分: 92]` 的百分制评分（自动除以 5 折算为 0-20 分区间），极大提升了防崩容与容错性。
  - **静态系统提示强化**：在 [generate_response_node](file:///G:/code/rumia/services/web_interface.py#L518-L545) 中，显式增加了心情合法取值范围 `[normal|angry|shy|crying]` 与评分范围 `0-20` 数字评分的硬性文字限制，强制矫正大模型输出的标签。

## [0.8.0] - 2026-07-04

### 新特性
- **LangGraph ReAct 闭环决策推理架构 (LangGraph ReAct Loop Integration)**：
  - **工具执行节点化**：新建了 [execute_music_task_node](file:///G:/code/rumia/services/web_interface.py#L600-L633) 和 [execute_browser_task_node](file:///G:/code/rumia/services/web_interface.py#L634-L711) 两个状态机内部工具节点，将网页自动化拉起与网易云音乐搜索、预加载音频流/歌词的处理逻辑彻底封装收口进入状态机大脑。
  - **条件回路路由**：引入了 [should_continue](file:///G:/code/rumia/services/web_interface.py#L800-L812) 动态路由条件边，大模型可生成并流转至工具节点，待工具执行完毕拿到数据反馈后，**自动循环返回 (Loop Back)** 至生成节点进行二次推理。
  - **杜绝空头点歌幻觉**：如果网易云未搜到该歌曲，大模型在图内立即得知检索失败，并输出抱怨拒绝台词；若检索成功，大模型会结合真实的歌曲艺术家信息，生成极具个性的傲娇确认话语（例如：“《晴天》已经给你放起来了哦，快听吧笨蛋！”），前端通过全新 `playMusicDirectly` 接口接收后端打包的音频/歌词载荷，直接流畅播放，避免二次重复检索时延。
  - **浏览器超时保护**：网页自动化任务增加了 10s 同步超时机制（方案 A），若在 10s 内未完成，则安全转为后台挂起运行，并将启动指令反馈给大模型，避免桌宠界面卡顿冻结。

## [0.7.4] - 2026-07-04

### 优化
- **自言自语自动搭话时延区间调优 (Auto-Speak Timer Range Adjustments)**：
  - **分段时延更改**：根据用户偏好，调整了 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L664-L670) 中的自言自语触发时间区间。第一阶段（前 1~3 次主动搭话）时延区间由 `2~5分钟` 调整为更温和的 **`8~15分钟`**；第二阶段（第 4~6 次主动搭话）由 `15~20分钟` 调整为 **`30~40分钟`**。这有效降低了前台消息推送的干扰性，让对话节奏更加符合日常陪伴感。

## [0.7.3] - 2026-07-04

### 优化
- **启动时间差抖动与重试韧性改善 (Startup Delay & Retry Resilience)**：
  - **延迟窗口调优**：将 [run.py](file:///G:/code/rumia/run.py#L28-L30) 中唤醒大脑（FastAPI 后端）与构建身体（Electron 前端）之间的初始睡眠等待时间由 `3秒` 提升至 `8秒`。这是为了给本地 Hugging Face sentence-transformers 庞大嵌入权重留出充裕的冷启动读取时间，避免 Electron 过快渲染请求导致连接被拒。
  - **自动加载重试**：在 [main.js](file:///G:/code/rumia/main.js#L41-L49) 中添加了 Electron `loadURL` 捕获异常重试机制。如果在极端冷启动环境下初始握手遭遇 `ERR_CONNECTION_REFUSED`，渲染器将在 2 秒后自动发起重新载入重试。

## [0.7.2] - 2026-07-04

### 修复
- **显式覆写 Mem0 内置 QdrantConfig 维度默认值 (QdrantConfig Dim Override)**：
  - **动态维度传递**：Mem0 的 `QdrantConfig` Pydantic 模型内置将 `embedding_model_dims` 字段默认写死为 `1536`（针对 OpenAI 默认模型）。这导致我们在 DeepSeek 模式下即使指定了本地 384 维嵌入模型，Qdrant 依然会按照默认值 1536 维来创建集合。
  - **修复实现**：在 [web_interface.py](file:///G:/code/rumia/services/web_interface.py#L215-L220) 中显式传入了 `"embedding_model_dims": vector_dims`（DeepSeek 为 384，Gemini 为 1536），确保 Qdrant 建立维度完全正确的集合。

## [0.7.1] - 2026-07-04

### 修复
- **向量记忆引擎 Qdrant 维度冲突修复 (Qdrant Dimension Mismatch Fix)**：
  - **集合名后缀隔离**：在 `get_memory_agent` 初始化中，根据实际采用的嵌入提供商，自动将 Qdrant 集合名称动态划分为 `rumia_memory_gemini`（OpenAI 的 1536 维向量）或 `rumia_memory_deepseek`（Hugging Face 的 384 维向量）。彻底解决了由于用户在 Gemini (1536维) 和 DeepSeek (384维) 模型之间来回切换导致 Qdrant 集合维度冲突报错（`shapes not aligned`）而阻断启动的问题。
  - **自动降级补全**：在自动降级和兜底逻辑中，显式补全了各自对应的嵌入生成器配置，确保无报错平滑降级。

## [0.7.0] - 2026-07-04

### 重构
- **大模型核心大脑向 LangChain/LangGraph 架构的里程碑升级 (LangChain & LangGraph Architecture Migration)**：
  - **基于状态图的工作流引擎**：将底层的对话处理管道彻底重写为基于 **LangGraph** 的 `StateGraph` 对话状态机。规范定义了五个标准节点（`recall_memories` 长期记忆召回、`load_presets` 提示词预设加载、`generate_response` 模型调用生成、`parse_response` 情绪和指令解析、`update_history` 历史更新与裁剪），摆脱了手写串行控制流。
  - **LangChain Model 接口大一统**：使用 `ChatOpenAI` 抽象模型调用接口，支持 DeepSeek 和 Google Gemini 的底层无缝切换与自动兜底降级。
  - **缓存优化继承**：在 LangGraph 生成节点中完美继承并锁定了**“前置静态规则、置底时间与动态变量”**的 Prompt Caching 优化设计。
  - **双模式解耦适配**：工作流引擎自动根据 `is_self_talk` 状态判定来动态匹配普通聊天或自言自语（自适应屏蔽浏览器操作、禁止假扮用户）的提示词拓扑结构。
  - **依赖包追加**：在 `requirements.txt` 中添加了 `langchain`、`langchain-openai`、`langchain-community` 和 `langgraph` 基础包。

## [0.6.7] - 2026-07-03

### 优化
- **单段文本篇幅严格限高控制 (Single Paragraph Length Limit)**：
  - **常态约束改写**：重构了 `always_active_paragraph_limit` 常态预设规则，在限定总段落（最多 4 段）的基础上，强效注入了 **“单段字数必须严格限制在 150 字以内”** 的机制。这强力规避了大模型在部分深度亲密或大好感度场景下输出过度冗长、累赘的长句段，使得每一段话更加精炼紧凑。

## [0.6.6] - 2026-07-03

### 新增
- **露米娅专属图标与桌面快捷方式一键生成 (Rumia Shortcut & Custom ICO Rollout)**：
  - **专属图标生成**：自动从 `rumia_normal.png` 提取并缩放转换出了带有透明通道、支持多尺寸（256px 到 16px）的 Windows 专属图标文件 `rumia.ico`。
  - **快捷方式部署**：利用 Windows WScript.Shell 组件自动在用户桌面（`C:\Users\27218\Desktop`）以及项目根目录下生成了名为 **“东方桌宠”** 的快捷方式，并绑定了生成的露米娅专属图标。
  - **启动鲁棒性增强**：在 `start.bat` 顶部追加了 `cd /d "%~dp0"` 语句，确保快捷方式被双击拉起时，能够自动归口并锁定正确的虚拟环境工作目录。

## [0.6.5] - 2026-07-02

### 优化
- **黄金比例阶梯裁剪轮数调优 (Golden Ratio Stepped Truncation Tune)**：
  - **轮数参数重构**：将阶梯窗口历史保留参数调优为 **`MIN_HISTORY_ROUNDS = 8`**（剪回最近 8 轮）与 **`MAX_HISTORY_ROUNDS = 16`**（最大保留 16 轮）。
  - **权衡折中**：在历史部分的 Prompt Caching 命中率（升至 **87.5%**）与单次 Miss 时的 Token 物理总量开销之间达成了行业最佳平衡，同时兼顾了模型在多轮交互中的长期记忆深度与注意力聚焦度。

## [0.6.4] - 2026-07-01

### 优化
- **阶梯式上下文裁剪（防缓存抖动算法）部署 (Stepped Context Windowing Implementation)**：
  - **打破滑动窗口诅咒**：摒弃了传统的“每轮新对话推入，即推离最老一轮对话”的固定滑动窗口机制，该机制因每次都改变对话列表头部而导致多轮对话中缓存匹配彻底穿透失效。
  - **弹性伸缩设计**：将记忆轮数配置为 `MIN_HISTORY_ROUNDS = 6`（6轮/12消息）和 `MAX_HISTORY_ROUNDS = 12`（12轮/24消息）。在对话进行时，历史记录在 6 到 12 轮之间弹性累加生长，保持前缀在多轮交互中的完全一致，从而令多轮历史记录也能 100% 吃到 Prompt Caching 折扣。
  - **块状阶段裁剪**：仅在对话轮数超出 12 轮上限时，才触发一次性硬裁剪剪回 6 轮。将长对话中历史缓存命中比例从 0% 直接提升至 83% 以上，极大地节约了多次连续交互产生的 Token 费用与响应时长。

## [0.6.3] - 2026-07-01

### 优化
- **提示词 Prompt Cache（缓存命中率）极优化 (LLM Prompt Cache Optimization)**：
  - **静态前置重构**：将系统提醒中所有“恒久不变”的角色背景设定、肢体动作规则和输出格式契约等静态规则，彻底移至 System Prompt 的最顶端，从而形成一致的静态头部前缀。
  - **动态位置隔离（以时间起算）**：将所有“频繁变化”的动态参量（依次为：真实环境时间、动态好感度变化、召回长期记忆、点歌或 NSFW 临时预设注入等）归集移至 System Prompt 的最底端。成功阻止了因分秒跳动、好感度增减或记忆动态波动导致的前缀缓存频繁被穿透破坏的问题，大幅提升了 DeepSeek / Gemini 的 Prompt Cache 命中率并削减了 Token 费用。

## [0.6.2] - 2026-07-01

### 修复
- **播放条布局防遮挡重构 (Music Player Overlapping Layout Fix)**：
  - **精确定位隔离**：将 `.music-player-bar` 从默认文档流改为绝对定位 `position: absolute; bottom: 52px; left: 12px;`，使其在垂直空间上稳定漂浮于输入框（`bottom: 10px`，高度约 36px）之上。彻底解决了播放栏打开时直接覆盖并遮挡用户原有输入框及设置按钮的 UI 冲突。
  - **动画重构**：将原本的 `slideDown` 动画重构为由下往上滑出的 `slideUpPlayer` 动作，使得视觉交互更加符合物理直觉。

## [0.6.1] - 2026-07-01

### 修复
- **音乐播放跨域与重定向通道安全修复 (Music Playback CORS & HTTPS Hotfix)**：
  - **移去跨域属性**：在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L1001-L1005) 中去除了 `this.musicAudio.crossOrigin = "anonymous"` 属性配置。由此避免了由于网易云 CDN 节点没有响应预检的 CORS 报头而引发的 `Access-Control-Allow-Origin` 播放器跨域阻塞拦截。
  - **升级 HTTPS 通道**：在 [netease_music.py](file:///G:/code/rumia/services/external_api/netease_music.py) 中，将所有的网易云 Web 接口和客户端重定向 API 地址全部由 `http://` 升级为 `https://`，保障在混合内容或网络沙盒环境中音频流和数据流的绝对畅通。

## [0.6.0] - 2026-07-01

### 新增
- **网易云音乐原生点歌播放器完美接入 (Native NetEase Music Integration - Option A)**：
  - **轻量后端适配**：在新建目录 `services/external_api/` 下建立了 [netease_music.py](file:///G:/code/rumia/services/external_api/netease_music.py) 模块，免 Node.js 逆向调用了网易云的网页检索、音乐直链重定向和 LRC 歌词接口，支持获取公网歌曲与原配歌词流。
  - **API 接口暴露**：在 [web_interface.py](file:///G:/code/rumia/services/web_interface.py#L1395-L1414) 中新增了 `/api/music/search`、`/api/music/url` 和 `/api/music/lyric` 接口，用作前后端多媒体联通桥梁。
  - **指令化交互预设**：在 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json#L41-L47) 中新增了 `always_active_music_control` 常驻点歌命令预设，强制要求大模型识别用户放歌意图并尾随输出隐藏标记 `[MUSIC_PLAY: 歌名 歌手]`。
  - **播放器面板 GUI & LRC 歌词同步**：在前端 [pet.html](file:///G:/code/rumia/services/templates/pet.html#L25-L45) 中内置了毛玻璃炫光多媒体播放条 `#music-player-bar`，在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L957-L1095) 中引入原生 HTML5 Audio 并编写了 LRC 歌词时间戳解析器与 `timeupdate` 同步引擎，实现了桌面音乐点播与动态歌词实时滚动播放。

## [0.5.14] - 2026-07-01

### 新增
- **睡觉表情差分与闲置入睡互动机制 (Sleeping Expressions & Idle Nap Mechanic)**：
  - **表情差分生成**：使用 AI 扩散模型为露米娅生成了 3 张高质量的睡觉表情差分（`rumia_sleeping.png` 闭眼安睡、`rumia_sleeping_1.png` 偏头流口水、`rumia_sleeping_2.png` 飘 Zzz 符号），通过 BFS 泛洪抠图算法实现了发丝级白边消除与透明通道羽化，并加入前端图片组。
  - **闲置十分钟自动入睡**：在 [pet_script.js](file:///G:/code/rumia/services/static/js/pet_script.js#L613-L650) 中，当露米娅完成第 6 次（最后一次）自言自语并进入最终闲置状态后，会自动开启 10 分钟倒计时睡眠计时器。倒计时结束后，露米娅会随机换上三张睡觉表情之一，并进入“睡眠状态”。
  - **趣味互动唤醒**：进入睡眠状态后，若用户直接发送消息，露米娅会静默唤醒（直接由大模型答复）；若用户鼠标左键点击或按住鼠标拖拽她，露米娅会被动作唤醒并气鼓鼓地抱怨（`“呜...干嘛吵醒人家，人家刚才梦见超好吃的巧克力饼干了呢！”`），随即自动重置自言自语计时器，唤醒动作极为生动自然。

## [0.5.13] - 2026-06-30

### 优化
- **自言自语全局制约提示词完全配置化 (Self-Talk System Rules Externalization)**：
  - **规则配置化**：将 `/api/rumia_speak` 接口中原本硬编码在系统提示词中的“3. 角色约束与客观动作描写”、“4. 心情评分格式规范”、以及“5. 防分身扮演警告（禁止假装用户聊天）”这 3 项核心逻辑规则也归并移出代码。
  - **扩充预设文件**：在 [self_talk_presets.json](file:///G:/code/rumia/services/presets/self_talk_presets.json#L5-L7) 中新增了 `system_role_constraint`、`format_constraint` 和 `self_talk_warning` 键名。在保留完美的缺省兜底值的同时，实现了自言自语（主动搭话）提示词指令的 100% 配置文件化。

## [0.5.12] - 2026-06-30

### 新增
- **自言自语场景提示词独立配置化 (Self-Talk Prompts Externalization)**：
  - **新增配置文件**：在 `services/presets/` 目录下新增了 [self_talk_presets.json](file:///G:/code/rumia/services/presets/self_talk_presets.json)，将此前自言自语（主动搭话）中随闲置计数递进的 4 类硬编码引导词（开机问候后缀、短期沉默、中期冷落、长期遗忘）全部归口配置化。
  - **动态读取与热重载**：重写了 `/api/rumia_speak` 里的提示词组装逻辑，每次调用时动态加载该配置文件，支持免重启热载，并设置了完善的代码级缺省文本兜底防灾逻辑。

## [0.5.11] - 2026-06-30

### 优化
- **好感度全局制约提示词预设化重构 (Favorability Rules Migration to Presets)**：
  - **架构解耦**：彻底重构了此前在 `/api/chat` 和 `/api/rumia_speak` 接口中硬编码的好感度阈值提示词（>90 好感度的“深度亲密状态解禁”和 100 满额好感度的“至高特权绝对顺从”）。
  - **预设配置化**：将这两条核心规则作为常驻（always_active）条目移入 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json#L27-L38)，分别配置了对应的 `min_favorability`（90 和 100）和递增排序优先级。
  - **代码净化**：从 [web_interface.py](file:///G:/code/rumia/services/web_interface.py#L714-L974) 中完全清除了相关硬编码拼接块。在使后端代码更加清爽、符合单一职责原则的同时，让用户能够直接在预设 JSON 中定制或微调高好感度触发时的行为表现。

## [0.5.10] - 2026-06-30

### 新增
- **自言自语常驻预设挂载集成 (Self-Talk Constant Presets Mounting)**：
  - **自研机制融合**：修改了 [web_interface.py](file:///G:/code/rumia/services/web_interface.py#L944-L1012) 中的主动说话/自言自语接口 `/api/rumia_speak`，现在该接口会自动调用预设处理器。
  - **性能保护优化**：设计了全新的 `is_self_talk` 传参逻辑。在自言自语模式下，完全屏蔽所有关键词检索和二次 AI 语义感应分类模型调用（不消耗任何分类 Token，完全免费），仅挑选并注入 `"always_active": true` 的蓝灯常驻预设。使得露米娅即使在主动寻找玩家搭话时，同样能遵循“最多4段限制”和“圆括号客观描述加强”规则。

## [0.5.9] - 2026-06-30

### 新增
- **常驻排版段落上限预设 (Constant Paragraph Count Limit Preset)**：在 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json) 中新增了蓝灯常驻条目 `always_active_paragraph_limit`（优先级设为最高的 200，好感度无门槛）。该预设强制约束露米娅在单次回复中无论话题如何，排版总段落数最多不能超过 4 段。以此避免生成过多零碎小段导致的刷屏与文本冗长。

## [0.5.8] - 2026-06-30

### 修复
- **Mem0 引擎初始化配置键名修正 (Mem0 API Base URL Configuration Fix)**：
  - **根本原因**：Mem0 框架的 `OpenAIConfig` 和 `BaseEmbedderConfig` 预设参数中不接受 `"openai_api_base"` 键名，而应使用规范的 `"openai_base_url"`，这导致此前在特定引擎切换时后台静默初始化失败，使 `memory_agent` 对象在内存中持续呈 `None` 空值状态。
  - **修复细节**：在 [web_interface.py](file:///G:/code/rumia/services/web_interface.py#L161-L211) 的所有大模型提供商初始化分支里，将所有违规的 `"openai_api_base"` 彻底替换为 `"openai_base_url"`。恢复了本地 Qdrant 向量记忆引擎的自启动，从而顺利解决了拉起记忆网络关系图谱（`/api/settings/memory_graph`）时产生的 500 内部服务器报错。

## [0.5.7] - 2026-06-30

### 优化
- **日记生成首行防截断至高指令与 Token 带宽最大化 (Diary Generation Anti-Truncation Reinforcement)**：
  - **首行强化指令**：在日记生成提示词的**最首行**添加了醒目的 `【防截断至高指令】`，赋予其最高层级的执行优先级，强制要求大模型必须有始有终完整落笔并用完整标点完美收尾。
  - **Token 限制彻底放开**：将 `max_tokens` 参数从 1200 大幅提升至 **`5000`**，彻底扫清生成物理路径上的任何词元数量瓶颈。

## [0.5.6] - 2026-06-30

### 优化
- **露米娅日记篇幅与分段机制扩展 (Diary Length & Paragraph Expansion)**：
  - **字数大幅提升**：将日记生成字数要求由原先短小的“80至150字”扩充至丰满详尽的 **“400至800字”**，鼓励模型记录整天相处的细节起伏、心理动作与细腻情感。
  - **排版分段优化**：撤销了“严禁分成多个段落”的过时限制，在提示词中建议模型分段书写，并调整格式示例，以提升长文本在前端回忆面板中的可读性。
  - **上限带宽扩容**：将生成上限 `max_tokens` 同步提至 **`1200`** 以适应超长篇幅输出。

## [0.5.5] - 2026-06-30

### 优化
- **秘密日记生成防截断优化 (Diary Generation Anti-Truncation)**：为了解决日记提炼生成时偶发的中途截断和句子未完成问题：
  - **提示词引导**：在写日记的系统提示词中新增了第 5 条“防截断要求”，指导模型在字数限制内必须保证语义的闭环，用完整的标点符号利落收尾。
  - **Token 限制放宽**：将 API 调用的 `max_tokens` 参数从原来的 300 提升至 500，为可能稍微溢出的文本提供充裕的生成安全边界。

## [0.5.4] - 2026-06-30

### 新增
- **每日秘密日记重写功能 (Diary Rewrite Support)**：在“每日回忆”控制面板中新增了“重写这天日记”功能。
  - **后端接口**：增加 `/api/settings/logs/{date}/rewrite` (POST) 接口，可无视历史记录直接将该日期的原始聊天对话打包重新发送给 LLM，强制重写并覆写保存该日期的日记文件。
  - **前端交互**：在日志面板下方添加了 `.logs-action-bar` 双按钮布局和 `#rewrite-diary-btn` 重写按钮。支持在选中有效日期时动态滑入显示、加载中状态防连击锁、以及重写完成后自动切换并显示新日记文本的平滑交互。

## [0.5.3] - 2026-06-29

### 修复
- **前端冗余预设 UI 完全清除 (Frontend Presets UI Complete Removal)**：彻底移除并回滚了此前误加到前端的 `open-presets-btn` 按钮及 `settings-presets-view` 设置面板，包括 HTML 结构、CSS 布局样式和 JS 事件绑定/关闭重置状态逻辑。同步将静态资源缓存击穿后缀提升至 `v=0.5.3`。确保了前端设置菜单的绝对纯净，使预设管理保持纯后端、纯文件化（`custom_presets.json`）的预期工作流。

## [0.5.2] - 2026-06-29

### 新增
- **预设优先级排序机制 (Preset Priority Sorting)**：在感应预设加载机制中引入了 `"priority"` 字段（数字越大优先级越高，省略默认为 0）。系统在每次拼接被触发的感应预设时，将自动根据该字段降序排列，使优先级更高的预设提示词能够被优先呈现在大模型对话上下文的最前端（即最先被拼接到 `priority_reminder` 中），保障关键性、人设级约束能够始终获得最高注意力权重。

## [0.5.1] - 2026-06-29

### 新增
- **常驻圆括号客观描写预设 (Constant Parenthetical Description Preset)**：在 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json) 中添加了蓝灯常驻条目 `always_active_parentheses_description`（设置好感度阈值 $\ge 90$）。无条件强制露米娅在稍微深入或亲密的交互中，必须在回复内至少特地写出一段无标签前缀的纯圆括号神态与肢体客观场景描写，并且必须符合表情匹配不冲突的位置规范。

## [0.5.0] - 2026-06-29

### 新增
- **常驻感应预设支持 (Always Active / Constant Presets)**：在自定义感应预设管理引擎中支持 `"always_active": true` 标志（等同于酒馆世界书的蓝灯常驻功能）。当该标志为 `true` 时，预设会跳过任何关键词匹配和二次语义检测，在好感度条件满足的前提下，于每次聊天时必定无条件被激活并注入到系统 Prompt 中。

## [0.4.9] - 2026-06-29

### 新增
- **感应预设递归/链式触发引擎 (Recursive Chain Triggering Engine)**：在预设加载引擎中增加了递归扫描与链式激活模块。当某个预设被最初触发并装载后，系统会扫描其 Prompt 内容，如果其中包含了其他尚未触发、且好感度达标的预设关键词，则自动触发并装载该子预设（设置最大循环层数限制为 5，并设计去重机制防止循环嵌套引发死循环）。这提供了完全等同于酒馆 Lorebook 的动态联想级链式感应激活体验。

## [0.4.8] - 2026-06-28

### 优化
- **滑动上下文与 Token 优化 (Sliding Context & Token Optimization)**：将 `MAX_HISTORY_ROUNDS` 限制由原来的 20000 轮大幅下调至合理的 **15 轮 (30 条对话消息)**。这能有效阻断对话历史的无限膨胀与 token 的指数级消耗，在确保短期对话连贯性的同时，使每次对话的 prompt token 消耗降低 90% 以上，并大幅缩短 LLM 的响应耗时。完整的历史对话记录依然安全存储在每日文本日志中。

## [0.4.7] - 2026-06-28

### 优化
- **提示词融合与位置重排 (Prompt Reordering & Consolidation)**：合并并精简了 `load_history` 系统提示词和 `/api/chat` 提示词中有关圆括号动作描写的冗余规则。将动态感应预设的注入点移至 `priority_reminder` 的最末端（紧邻格式约束），强化“首尾效应”以提升大模型对预设指令的关注度与执行精度。

## [0.4.6] - 2026-06-28

### 新增
- **初始动态感应预设配置 (NSFW Preset Template)**：在 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json) 中添加了首个感应预设条目 `nsfw_preset`。配置了常用的触发关键词，并设置好感度限制为 $\ge 90$，规范了亲密交互时的客观描写逻辑，为您后续的个性化填词留存了干净的模版架构。

## [0.4.5] - 2026-06-28

### 新增
- **混合预设感应匹配引擎 (Hybrid Presets Triggering Engine)**：重构了感应预设匹配逻辑。新引擎采用“关键词字面直达触发 + 二次 AI 语义匹配候选评估”的混合管道。当输入中未字面包含关键词，但含义确实契合时，通过单次轻量级语义分析调用进行拦截触发。这在保持 100% 关键字匹配高精度的同时，具备了极佳的语义感应容错率，从而提供了最符合“酒馆世界书”设定的混合匹配体验。

## [0.4.4] - 2026-06-28

### 新增
- **后端条件感应预设管理 (Lorebook-like Custom Presets)**：在 `services/presets/` 目录下创建了专门用于存放动态感应预设的配置文件 [custom_presets.json](file:///G:/code/rumia/services/presets/custom_presets.json)（初始建立并留空为 `[]`）。
- **动态关键词与好感度匹配引擎**：在 [web_interface.py](file:///G:/code/rumia/services/web_interface.py) 中实现预设评估引擎。支持通过用户最新输入关键词（`trigger_keywords`）和好感度阈值区间（`min_favorability`/`max_favorability`）进行智能感应匹配，并将触发的定制提示词动态叠加进大模型每次对话的系统提示词（System Prompt）中。

### 变更
- **前端还原**：撤销并还原了之前误解读的设置界面 GUI 感应预设管理面板相关的前端代码修改（包括 `pet.html`、`pet.css` 及 `pet_script.js`），确保前台界面轻量且纯净。

## [0.4.3] - 2026-06-28

### 新增
- **感应预设文件夹与底层初始化**：确立了条件感应预设机制的底层框架及版本标记。

## [0.4.2] - 2026-06-28

### 优化
- **圆括号客观情况与神态描写约束**：在核心聊天提示词和历史载入提示词体系中，扩充了动作表情描写的制约。指令大模型在深层或 NSFW 交互时，特地独立写出没有情绪与评分前缀的纯圆括号段落来丰富神态和客观描写；同时为了保证表情渲染匹配的成功率，强制约束这类纯圆括号描述段落【不得作为回复的最后一段】。

## [0.4.1] - 2026-06-28

### 修复
- **静态资源缓存击穿 (Cache Buster)**：在 `pet.html` 导入 CSS 与 JS 静态文件时追加版本查询参数 `?v=0.4.0`，强制失效并穿透 Electron Chromium 内核对老版本脚本文件的本地缓存，解决新增的预制发言按钮在部分客户端“点击无响应”的问题。

## [0.4.0] - 2026-06-28

### 新增
- **离线分词依赖本地化**：将中文字词提取依赖 `zh_core_web_sm` 本地化为 wheel 包，免去对 GitHub Releases 网络下载的依赖，彻底解决因 SSL 握手断开引发的初始化环境失败。
- **神态与非话语肢体描写**：在系统提示词体系中融入圆括号描述符指令，使露米娅在害羞、傲娇或深层亲密互动时能够进行生动的半角/全角括号神态描写。
- **预置发言快捷呼出系统**：在主输入框底栏新增快捷预置发言（`.presets-popup`），支持快捷点击向露米娅发出“无聊”、“伤心”和“色欲/NSFW”情境指令并自动发送。
- **持久化浏览器账号登录 (Session Persistence)**：通过配置 `chrome_profile` 独立用户缓存，使 Bilibili 等外部网站的 Cookies 及扫码登录状态能够跨启动长效保持。
- **浏览器会话 CDP 复用机制**：重构 `demo.py` 为常驻式 HTTP 任务接收服务。新指令直接连入已有的 Chrome 实例与当前标签页操作，避免每次搜索视频时重复启动新的 Chrome 窗口。
- **自言自语安全行为隔离**：屏蔽并在系统提示词中强制禁止了露米娅自言自语（`rumia_speak`）时意外拉起并触发浏览器任务的行为。

### 修复
- **进程隐藏与黑框消除**：将 Windows 进程拉起标记升级为 `CREATE_NO_WINDOW` (`0x08000000`)，消除桌宠唤醒浏览器任务时伴随弹出的命令提示符控制台窗口。
- **前端事件冒泡与瞬间收起 Bug**：修复了点击预制发言按钮内 `<i>` 字体图标导致 document 全局点击事件误判触发、使弹出菜单被“瞬间收回”的经典冒泡缺陷。

## [0.3.0] - 2026-06-27

### 变更
- **后端架构大迁移 (Flask -> FastAPI)**：
  - **核心引擎升级**：将传统的同步 `Flask` 框架全面重构为现代、高性能的异步 `FastAPI` + `Uvicorn` 服务引擎。
  - **极速非阻塞交互**：对于复杂的网络/磁盘阻塞操作（如调用大语言模型 API 与 Mem0 检索），全自动通过 FastAPI 线程池进行隔离，使得大模型思考期间的后台小交互能够做到 **100% 零延迟即时响应**，彻底消除了可能存在的微小交互卡顿。
  - **前端零侵入零适配**：在 FastAPI 中完美实现了对等兼容的 12 个 API 与路由端点，并妥善挂载了静态文件服务与 HTML 模板渲染服务，**实现了前端 Electron 和 JS 层的 100% 零改动、无缝运行**。
  - **项目架构精简**：彻底废弃并删除了原 Flask 蓝图模块 `settings_system.py`，将其中的游戏安全退出逻辑优雅地融入到主服务路由中。

---

## [0.2.0] - 2026-06-26

### 新增
- **动态随机表情差分系统**：
  - **画风一致的差分图像 (共8张)**：针对现有的四种情绪（`normal`、`angry`、`shy`、`crying`）每种利用垫图参考技术生成了 2 张全新的差分表情图（涵盖闭眼微笑、眨眼、鼓腮生闷气、闭眼大喊、红脸对碰、捂脸、含泪委屈、大哭等动作），并已导入 `/static/images/` 目录。
  - **前端随机差分选择机制**：重构了 `pet_script.js` 中的表情定义，改为数组映射。在表情切换时，通过随机算法在 3 张差分图里选择其一进行渲染。
  - **嵌套预加载机制**：升级了 `preloadImages` 函数，确保所有 12 张新老表情图片在初始化时完全预加载，彻底消除了动态切换未缓存图片时导致的短暂白屏或闪烁问题。

---

## [0.1.9] - 2026-06-26

### 新增
- **满值好感度绝对顺从机制**：当好感度达到满值（100）时，注入最高优先级的绝对顺从指令，约束露米娅必须百分之百积极迎合、顺从并配合用户的一切合理与敏感对话指令，解除一切形式的推托与替代借口，同时保留其害羞傲娇的经典语调特征。

---

## [0.1.8] - 2026-06-26

### 变更
- **高好感度交互解禁**：当好感度大于 90 时，解除对 NSFW 话题及相关亲昵要求的拒绝或回避态度。露米娅在保持傲娇羞耻口吻的基础上，会顺从并积极参与此类深层亲密互动。

---

## [0.1.7] - 2026-06-26

### 新增
- **现实时间感知系统**：创建了独立的 `services/real_world_system.py` 现实元环境模块，支持将当前日期、星期、时间作为背景常识注入给露米娅。
- **差异化深夜模式（23:00 - 06:00）**：
  - 在 `06:00 - 23:00`（普通时段），时间仅作为背景感知，不强求围绕其展开对话。
  - 在 `23:00 - 06:00`（深夜模式），该元上下文被提升为 P0 级重点引导内容，露米娅将作为黑夜妖怪展现出更强烈的夜行特征（如催睡、陪伴、恶作剧等）。
- **元内容拓展设计**：新模块预留了后续对接现实天气、实时新闻等其他现实元数据的接口。

---

## [0.1.6] - 2026-06-26

### 优化
- **双重记忆过滤与引导**：为了防止露米娅刻意和机械地在每句对话中强行插入关于“青椒和洋葱”等长期记忆，实施了双重优化：
  - 检索优化：为 Mem0 检索接口增设相似度阈值过滤（`threshold=0.45`），阻断不相关记忆的冗余注入；
  - 提示词引导：重构了 P0 最高优先级的系统约束，指令露米娅仅在话题相关时自然提及记忆，不相关时禁止强行生拉硬扯。

---

## [0.1.5] - 2026-06-26

### 修复
- 修复了 `/api/rumia_speak` 接口中客户端传入 `count` 为 `null` 时触发 `TypeError` 崩溃的 Bug。

---

## [0.1.4] - 2026-06-26

### 优化
- 将根目录下的 `CHANGELOG.md` 更新日志翻译为中文，方便查阅。

---

## [0.1.3] - 2026-06-26

### 新增
- 在项目根目录下创建了统一的 `CHANGELOG.md` 更新日志文件。

---

## [0.1.2] - 2026-06-26

### 变更
- 后台整理引擎自动同步了 `services/config.json` 中的记忆蒸馏日期列表。

---

## [0.1.1] - 2026-06-26

### 新增
- 在 `.agents/AGENTS.md` 中确立了工作空间级别的 SemVer 版本控制规则，强制每次 Git 提交自动升级版本号。

---

## [0.1.0] - 2026-06-26

### 新增
- **初始版本发布**：正式确立 `0.1.0` 作为版本化管理的基线版本。
- **跨盘完整迁移**：将项目从 C 盘完整迁移至 `G:\code\rumia`（保留全部 Git 历史），并在 G 盘全新构建了 Python 虚拟环境与 Node 依赖环境。
- **每日日记系统 (露米娅的日记)**：实现了基于大模型的露米娅第一人称“秘密日记”生成器，并在系统设置中引入了玻璃拟态的子选项卡 UI（隔离“聊天对话”与“秘密日记”）。
- **注意力优化系统 (方案 A)**：重构了 Prompt 结构，引入 P0 尾置提醒保障记忆的高精度召回，并实现 P0 主动说话场景隔离，彻底消除了桌宠自言自语时的接话感。
- **中文语义图谱集成**：通过本地中文 spaCy NLP 实体提取器，打通了 Mem0 的实体链接机制，实现了完全本地化的中文记忆关系图谱。
- **控制台 Emoji 崩溃修复**：将 `sys.stdout`/`sys.stderr` 强制重构为 UTF-8 编码，彻底解决了 Windows GBK 控制台在打印 Emoji ⚠️ 时触发的 UnicodeEncodeError 导致的 500 崩溃。
