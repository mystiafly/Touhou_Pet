# 东方桌宠动态数据库 (DataBank) 指南

DataBank 是东方桌宠的核心长期记忆与动态演进中枢。与传统的纯向量数据库不同，DataBank 采用结构化的“动态表格”形式，由大模型在对话后异步进行提炼与更新。

---

## 一、标准数据表 Schema

默认包含以下五大核心数据表：

1. **用户档案表 (`sheet_user_profile`)**：
   - 记录项、详细描述；
   - 收集用户的真实喜好、厌恶、职业、作息、现实经历等。
2. **桌宠当前状态表 (`sheet_pet_status`)**：
   - 当前心情、正在做的事、好感度(0-100)；
   - 单行唯一记录，随对话实时更新。
3. **羁绊与纪念表 (`sheet_memories`)**：
   - 事件摘要、对两人的意义与影响；
   - 记录重大里程碑、约定或难忘瞬间（上限 10 条）。
4. **备忘与话题表 (`sheet_topics`)**：
   - 事项内容、状态 [待办/进行中/已完成/已聊过]；
   - 用于稍后回访或提醒的任务事项。
5. **日常摘要表 (`sheet_summary`)**：
   - 时间段、聊天摘要、时间点、关键字；
   - 按交互阶段提炼的核心摘要日志。

---

## 二、模型提炼与更新语法

在每一轮对话结束后，后台异步的 Post-LLM 会分析刚才的对话，并通过专属的 ```databank 代码块输出更新指令：

```databank
UPDATE_TABLE: sheet_id, 行号或row_id, 列号(首列为0), 新值
INSERT_ROW: sheet_id, ["值1", "值2", ...]
DELETE_ROW: sheet_id, 行号或row_id
```

系统解析器 [`services/core/databank_manager.py`](file:///g:/code/rumia/services/core/databank_manager.py) 自动校验列长度并完成物理 JSON 写入，并在下一次交互中自动将更新后的表格摘要注入回桌宠的 System Prompt 中，形成永续演进的羁绊记忆。
