# 东方桌宠多角色系统与人设资产规范

东方桌宠拥有成熟的多角色隔离机制，支持任意东方 Project 原作角色无缝接入与一键切换。

---

## 一、角色的双目录资产结构

每个角色在系统中对应两套资源目录：

### 1. 业务逻辑与人设配置 (`services/characters/<char_id>/`)
* `config.json`：核心设定文件：
  ```json
  {
    "character_id": "flandre",
    "character_name": "芙兰朵露·斯卡蕾特",
    "persona_prompt": "你是东方Project中的芙兰朵露·斯卡蕾特...",
    "user_prompt": "我是一个神隐到幻想乡的外界人类...",
    "theme_color": "#ff4d6d",
    "active_skin": "default"
  }
  ```
* `presets.json`：常驻预设与条件触发词预设；
* `reactions.json`：角色专属好感度反应表与互动触发句式；
* `databank_template.json`：动态数据库模板骨架；
* `databank_state.json`：运行时数据库状态持久化；
* `diaries/`：角色每日心境日记归档（以日期命名）。

### 2. 前端立绘与 Live2D 资产 (`characters/<char_id>/`)
* 模型文件：`model.json` 或 `model3.json`（Live2D Cubism 规范）；
* 贴图与材质：`.png` 贴图文件、物理运算 `.physics3.json`、动作 `.motion3.json`；
* 语音与音效：`sounds/` 目录存放各动作对应的音效资源。

---

## 二、当前内置角色清单

| 角色 ID (`char_id`) | 角色中文名 | 身份特征 | 默认好感基调 |
| :--- | :--- | :--- | :--- |
| `rumia` | 露米娅 | 操纵黑暗的幼怪，傲娇微病娇，喜欢吃肉 | 傲娇、深夜活跃 |
| `flandre` | 芙兰朵露 | 红魔馆二小姐，七彩水晶翼，渴望玩伴 | 粘人、狂气与娇憨 |
| `mystia` | 米斯蒂娅 | 夜雀妖怪，居酒屋老板娘，朋克摇滚主唱 | 热情、务实、烟火气 |
| `koishi` | 古明地恋 | 紧闭第三只眼的有顶天无意识少女 | 灵动、跳脱、无拘无束 |
| `lily` | 莉莉白 | 告知春天来临的妖精，纯真烂漫 | 治愈、欢快、生命力 |
| `wriggle` | 莉格露 | 操纵昆虫的虫妖，森林巡逻守护者 | 元气、少年感、率真 |
