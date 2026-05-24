# 数据模型 (Data Schema)

> 与代码对齐版本。SQL 表见 `backend/app/models/*`，迁移见 `backend/alembic/versions/*`。
> 向量集合见 `backend/app/services/lancedb_service.py`。

---

## SQL 表（SQLite，10 张实体表 + 1 个 FTS5 虚拟表）

### `projects` — 招聘项目

整套系统的锚点。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID(str) | 主键 |
| `client_name` | string(255) | 客户公司名；stub 项目里临时是 `"待 CA 解析"` |
| `project_name` | string(255) | 项目名称 |
| `jd_raw` | text | 客户原始 JD |
| `requirement_profile` | JSON | CA 通过澄清生成的结构化画像（硬/软性条件、薪资、地点等） |
| `status` | enum | `active` / `completed` / `archived` |
| `folder_path` | string(500) | 该项目在 `~/Desktop/Eagle/projects/` 下的子目录绝对路径 |
| `created_at`, `updated_at` | datetime |  |

> ⚠️ 早期版本有过的 `mode`（`precise` / `explore`）字段已删除（见迁移 `c1a2b3d4e5f6_drop_project_mode_column.py`）。新代码不应再引用。

---

### `candidates` — 全局人才池

不绑定项目；同一个候选人可同时存在于多个项目的 `project_candidates` 关联里。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID(str) | 主键 |
| `full_name` | string(255) | 姓名 |
| `current_title` | string(255) | 当前岗位 |
| `current_company` | string(255) | 当前公司 |
| `location` | string(255) | 工作地 |
| `years_experience` | float | 工作年限 |
| `salary_range` | string(255) | 薪资区间文本 |
| `education` | string(500) | 教育经历文本 |
| `school_canonical` | string(64) | 学校归一化名（迁移 `f6a7b8c9d0f1_add_school_canonical`），见 `services/school_normalizer.py` |
| `linkedin_url`, `liepin_url` | string(1000) | 平台个人主页 |
| `phone`, `email` | string | 用于 TA 查重（迁移 `b3e8f2a91c05`） |
| `raw_structured_data` | JSON | 插件 / TA 抓取的完整原始结构化数据，备份用 |
| `experience_summary` | text | 清洗后的工作经历摘要 — 主要的可向量化字段 |
| `confidence_score` | float | 信息置信度评分（见下文算法） |
| `source_platform` | string(100) | `linkedin` / `liepin` / `manual` / `image` / `pdf` / `text` 等 |
| `created_at`, `updated_at` | datetime |  |

#### `candidates_fts` — FTS5 虚拟表

SQLite 内置全文索引，BM25 排序。迁移 `e5f6a7b8c9d0_add_candidates_fts`。
通过触发器与 `candidates` 表保持同步，索引字段：`full_name`,
`current_title`, `current_company`, `location`, `education`,
`experience_summary`。`SearchService` 在自由文本搜索时用它做关键词召回。

#### 信息置信度评分 (`confidence_score`)

- 基准：**100**
- 每月衰减：**-5**
- 任期 30-40 月（期权兑现期）：**+20**（高异动可能）
- 任期 < 12 月（刚入职）：**-30**（难以被挖）
- < **60** 分：前端打 `⚠️ 信息可能过时 / 需激活` 标签

实现在 `backend/app/services/confidence_service.py`。

---

### `project_candidates` — 项目-候选人关联 + EA 评估结果

`(project_id, candidate_id)` 联合唯一。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID(str) | 主键 |
| `project_id` | UUID(str) | → `projects.id`，CASCADE |
| `candidate_id` | UUID(str) | → `candidates.id`，CASCADE |
| `match_score` | float | 总匹配分（0-100） |
| `dimension_scores` | JSON | `{"技能匹配": 85, "管理经验": 60, ...}` |
| `recommendation` | text | 推荐理由（给客户看的） |
| `risk_flags` | text | 风险提示（面试需深挖的点） |
| `hunter_feedback` | text | 猎头反馈原文 |
| `status` | enum | `pending` / `recommended` / `eliminated` / `interviewed` / `failed` |
| `evaluated_at` | datetime | EA 评估完成时间 |
| `trigger_source` | string(50) | 触发来源：`manual` / `ca_tool` / `talent_list` 等（迁移 `99c6c81aed9f`） |
| `llm_raw_output` | text | EA LLM 原始输出（debugging 用） |

---

### `preference_logs` — 猎头偏好反馈

EA 每次评估前会读取该项目的全部 `preference_logs` 作为额外上下文。

| 字段 | 说明 |
|---|---|
| `project_id` | 所属项目 |
| `candidate_id` | 可选；若是针对某个候选人的反馈 |
| `feedback_type` | `weight_adjustment` / `positive_signal` / `negative_signal` / `general` |
| `hunter_comment` | 原文 |
| `weight_adjustment` | JSON，例：`{"管理经验": 15, "技能匹配": -5}` |

---

### `skill_ontology` — RA 产出的行业技能图谱

跨项目共享 — 两个项目都涉及 AI 行业时引用同一条记录。

| 字段 | 说明 |
|---|---|
| `industry` | 行业名 |
| `concept` | 核心概念，如 "大模型部署 (LLM Deployment)" |
| `synonyms` | string[] |
| `tech_stack` | string[] |
| `prerequisites` | string[] |
| `key_positions` | string[] |
| `skill_relations` | `Record<string, string[]>` |
| `jargon` | `Record<string, string>` — 行业黑话 |

---

### `project_research` — 项目-调研结果关联

每次 RA 完成都会插入一行。

| 字段 | 说明 |
|---|---|
| `project_id` | → `projects.id` |
| `ontology_id` | → `skill_ontology.id`（同一行业可被多个项目复用） |
| `report_file_path` | RA Markdown 报告文件在磁盘上的绝对路径 |
| `status` | `pending` / `running` / `completed` / `failed`（迁移 `b7d4e1f92c05`） |
| `topic`, `additional_context` | 调研触发时的输入 |

---

### `conversation_logs` — CA 对话历史

| 字段 | 说明 |
|---|---|
| `project_id` | 必填，每条对话都挂在项目下 |
| `thread_id` | 可选，新对话挂到某条 thread；为 null 表示是 thread 功能上线前的 legacy 消息 |
| `role` | `hunter` / `assistant` |
| `content` | 文本 |
| `intent_json` | CA 从该轮解析出的结构化意图 |

---

### `conversation_threads` — 项目下的多线程对话（迁移 `d2e3f4a5b6c7`）

| 字段 | 说明 |
|---|---|
| `project_id` | → `projects.id` |
| `name` | 用户给 thread 起的名字 |
| `created_at` |  |

`GET /api/projects/{id}/threads` 返回真实 thread 后会**追加**一条
`is_legacy: true` 的合成 thread，对应 `thread_id IS NULL` 的历史消息，
为了在 UI 上能完整看到该项目所有对话。

---

### `talent_lists` — 跨项目人才清单（迁移 `a1b2c3d4e5f7`）

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `name` | 清单名 |
| `project_id` | 可空 → 孤儿清单（不绑定任何项目，纯收藏夹用途） |
| `filters_json` | 搜索条件快照（mirror `CandidateSearchRequest`），用于"复跑"清单 |
| `source` | `manual` / `ca_conversation`（CA 工具产物） |

---

### `talent_list_members` — 清单成员 + outreach 状态

`(list_id, candidate_id)` 联合唯一。

| 字段 | 说明 |
|---|---|
| `list_id` | → `talent_lists.id`，CASCADE |
| `candidate_id` | → `candidates.id`，CASCADE |
| `status` | `not_contacted` / `contacted` / `scheduled` / `declined` / `added_to_project` |
| `hunter_note` | 备注 |
| `added_at`, `updated_at` |  |

> `status` 与 `project_candidates.status` **职责分离**：
> 这里追踪 outreach 流程（外呼/约面/拒访），那里追踪项目业务里程碑
> （推荐/面试/淘汰）。当成员被「加入到项目评估」时，状态推进到
> `added_to_project`，后续以 `project_candidates` 为准。

---

## 向量数据库（LanceDB，本地文件存储）

存储路径：`~/Desktop/Eagle/data/lancedb/`

> 注意旧文档写的是 `chroma/`，那是 v1 → v2 迁移期的遗留；当前一律 `lancedb/`。

启动时 `validate_schemas()` 会校验现有表的向量维度是否与 `EMBEDDING_DIMENSIONS`
一致，不一致**自动 drop 重建**（数据丢失），常见于切换 Embedding 模型。

### 3 个 Collection

**`candidate_embeddings`** — 候选人 chunked embedding。
新版分块策略把 `full_name` / `current_title` / `current_company` /
`education` (含 `school_canonical`) / `experience_summary` /
`raw_structured_data` 混合切片，多条向量共享同一个 `candidate_id`，
检索时按 candidate 归并取最近 chunk 的距离。

**`requirement_embeddings`** — 项目需求 embedding，关联 `project_id`。
用于将来做"这个新入库的候选人可能适合你的 B 项目"的反向推荐。

**`industry_knowledge`** — RA 行业报告分段 embedding，关联 `source_ontology_id`。
EA 做"软性理解"（比如发现"光伏逆变器"和"储能"语义相近）时查询这个。

所有 collection 的 metadata 中都记录了 `embedding_model_version`，方便将来迁移。

---

## CA 工具契约（Coordinator Agent function-calling）

CA 暴露给 LLM 的工具一览（具体 schema 见 `backend/app/agents/tools.py`）：

| 工具 | 用途 |
|---|---|
| `update_project` | 把 stub 项目的 `client_name` / `project_name` 等字段回填为真实值。**stub 项目（`client_name == "待 CA 解析"`）必须最先调用这个** |
| `clarify_requirement` | 写入 / 更新项目的 `requirement_profile`，触发后台重新向量化到 `requirement_embeddings` |
| `search_talent_pool` | 调用 `SearchService` 做混合检索；支持 `query` + 硬过滤（location/years/company）+ `exclude_query` 语义排除 + `exclude_companies` 黑名单 |
| `trigger_evaluation` | 触发 EA 评估一个候选人（detached task） |
| `request_industry_research` | 触发 RA 调研（后台 task） |
| `update_preference` | 写入 `preference_logs`，可带 `weight_adjustment` |
