# 多角色 AI 桌面宠物引擎 (Multi-Character AI Desktop Pet Engine)

这是一个基于 FastAPI、LangGraph、Qdrant 向量数据库，并采用前端 Electron + HTML/JS 渲染的工业级高级 AI 桌面宠物项目。

相比传统的桌面宠物（如 VPet），本项目的核心突破在于 **“强 AI 灵魂注入”与“深度的本地环境感知”**：
- **深层持久化记忆**：内置的 LangGraph 记忆网络不仅保存了聊天历史，还能在后台动态提炼你的个人喜好（User Profile）与每日专属傲娇日记。
- **跨应用感知**：深度读取本地系统环境（例如能监听网易云音乐当前正在播放的曲目与歌词），真正做到“陪你用电脑”。
- **多角色隔离架构**：可以瞬间在不同角色之间切换。不仅立绘与 UI 色调会无缝变化，底层的 AI 大脑人格、好感度系统和记忆存档也完全隔离！

---

## 🛠️ 如何添加一个新角色 (How to Add a New Character)

本项目的设计极度模块化，如果你想为桌宠添加一个全新的角色（例如：`reimu` 灵梦），请严格按照以下步骤操作：

### 1. 建立角色大脑配置区
在 `services/characters/` 目录下创建一个以角色英文全小写命名的文件夹，例如 `services/characters/reimu/`。
在该文件夹内，你需要准备 4 个配置文件：

- **`config.json`**: 核心配置项
  ```json
  {
    "character_id": "reimu",
    "character_name": "博丽灵梦",
    "persona_prompt": "博丽神社的巫女，有点贪财，性格直率..."
  }
  ```
- **`presets.json`**: 预设自言自语台词库（包含 `eating`, `sleeping`, `waking_up`, `idle`, `angry` 等状态下主动弹出的对话气泡内容）。
- **`base_prompt.txt`**: 喂给大模型的静态全局 System Prompt，用于确立世界观和严格的 JSON 输出结构。
- **`dynamic_tail.txt`**: 动态后缀 Prompt，包含系统变量占位符（如 `{time_of_day}`, `{music_info}`），会在每次对话前动态注入。

### 2. 准备角色动态立绘
在 `services/static/images/` 目录下创建一个与角色 ID 同名的文件夹，例如 `services/static/images/reimu/`。
引擎的动画状态机要求这里必须 **严格存在 15 张透明底的 `.png` 图片**，对应 5 种基础心情及其 2 帧差分动画：
- `normal.png` (基准), `normal_1.png` (半闭眼), `normal_2.png` (全闭眼)
- `angry.png`, `angry_1.png`, `angry_2.png`
- `shy.png`, `shy_1.png`, `shy_2.png`
- `crying.png`, `crying_1.png`, `crying_2.png`
- `sleeping.png`, `sleeping_1.png`, `sleeping_2.png`

*(提示：可以通过修改本项目内的自动化 Python 抠图脚本，批量对 AI 生成的立绘进行差分拆解与处理。)*

### 3. 配置角色的专属 UI 主题色调
本项目支持基于 CSS 变量的全局主题无缝热切换。
打开 `services/static/css/pet.css`，在文件中添加一个新的 `.theme-<char_id>` CSS 类，用于覆盖默认的 `:root` 变量。
例如：
```css
body.theme-reimu {
  --theme-main: #ff4500;  /* 灵梦红 */
  --theme-hover: #cc3700;
  --theme-glow-05: rgba(255, 69, 0, 0.5);
  --theme-bg-015: rgba(255, 69, 0, 0.15);
  --theme-bg-035: rgba(255, 69, 0, 0.35);
  --theme-text-light: #ff8c66;
  --theme-text-bright: #ff3300;
  --theme-legend-pink: #ffd700; /* 可以修改为金黄色搭配 */
}
```
当你在设置中切换角色时，前端会自动将 `body` 挂载 `theme-reimu` 类名，实现 UI 的瞬间重绘。

### 4. 注册前端 UI 下拉菜单
打开 `services/templates/pet.html`，找到 `<select id="character-select">` 标签。
在里面增加一行新角色的选项，以便用户能够在界面中进行切换：
```html
<option value="reimu">灵梦 (Reimu)</option>
```

### 5. 重启应用
完成以上 4 步后，重启后端 FastAPI 和 Electron 客户端，新角色便会自动出现在设置面板的角色切换列表中了！
