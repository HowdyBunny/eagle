# Eagle Backend API 文档

> 这份是手写的"高信噪比"参考。**权威定义在 FastAPI 自动生成的 OpenAPI：**
> http://localhost:52777/docs (Swagger) | http://localhost:52777/redoc
> 当本文件与代码不一致时，请以 `/docs` 为准并把这份文件改齐。

## 基本信息

- **Base URL**: `http://127.0.0.1:52777`
- **API 前缀**: `/api`
- **认证**：**当前没有任何认证头**。后端只靠 `localhost` 监听 + `CORS_ORIGINS` 做隔离。
  早期版本的 `X-API-Key` 已经在重构中移除，前端 axios 实例也不再挂任何 Authorization。
- **实时通讯**：除了普通 HTTP，还有 SSE（`/chat/stream`）和 WebSocket（`/projects/bootstrap`），见下文。
- **错误格式**：FastAPI 默认 `{ "detail": string }`。422 的 `detail` 是数组（pydantic 校验细节）。

---

## System

### GET /api/health
```json
{ "status": "healthy", "service": "Eagle API" }
```

### POST /api/errors
前端 `window.onerror` / `unhandledrejection` 上报。请求体：
```json
{ "message": "...", "source": "file.tsx:12", "stack": "...", "context": "window.onerror" }
```
响应 204，无 body。

### GET /api/settings
返回当前运行时配置（密钥脱敏）。
```json
{
  "llm_provider": "openai",
  "llm_model": "gpt-5.2",
  "llm_base_url": "https://api.openai.com/v1",
  "tavily_configured": true,
  "embedding_model": "text-embedding-3-small",
  "embedding_base_url": null,
  "embedding_dimensions": 1536
}
```

### PUT /api/settings
**运行时热更新**。前端 Settings 页保存时调用。所有字段可选，提交什么改什么。
```json
{
  "llm_provider": "anthropic",
  "llm_api_key": "sk-ant-...",
  "llm_model": "claude-sonnet-4-6",
  "llm_base_url": null,
  "tavily_api_key": "tvly-...",
  "embedding_api_key": "sk-...",
  "embedding_model": "text-embedding-3-small",
  "embedding_base_url": null,
  "embedding_dimensions": 1536
}
```
响应：`{ "status": "updated", "persisted": true }`

- 更新会就地修改 `settings` 单例，下一次 agent 调用立即生效。
- 同时写回 `~/Desktop/Eagle/.env`，进程重启后仍然有效。
- 若 `embedding_dimensions` 变化，会自动触发 `validate_schemas()` → 旧 LanceDB 表被 drop。

---

## Projects

### POST /api/projects
创建项目（普通通路；新对话推荐用 WebSocket bootstrap，见下文）。
```json
{
  "client_name": "某科技公司",
  "project_name": "技术VP招募",
  "jd_raw": "我们需要一位有大模型部署经验的技术VP...",
  "requirement_profile": { "location": "新加坡", "hard_requirements": ["..."] }
}
```
> ⚠️ 早期文档里的 `mode` 字段已废弃（迁移 `c1a2b3d4e5f6`），不要再传。

响应 201：`Project`。

### GET /api/projects?skip=&limit=
列表（默认 `skip=0, limit=20`）。

### GET /api/projects/{id}
单个项目详情。404 表示不存在。

### PATCH /api/projects/{id}
部分更新。CA 工具 `update_project` / `clarify_requirement` 也是走这个端点
（前者填 `client_name` / `project_name`，后者填 `requirement_profile`）。
更新 `requirement_profile` 时后台自动重新向量化到 `requirement_embeddings`。

### DELETE /api/projects/{id}
级联删除：`project_candidates` / `preference_logs` / `conversation_logs` /
`conversation_threads` / `project_research`。`talent_lists.project_id`
被 `SET NULL`（清单本身保留，变成孤儿清单）。

### WS /api/projects/bootstrap（WebSocket）
**新建项目 + 首次 CA 解析**走同一条 WebSocket。

客户端→服务端，连接后发一条 JSON：
```json
{ "message": "帮 X 公司招一个高级 BMS 工程师，5 年以上经验..." }
```

服务端→客户端流式事件（每条都是独立 JSON）：
```json
{ "type": "status",          "message": "正在创建项目…" }
{ "type": "project_created", "project": { ...ProjectResponse } }
{ "type": "status",          "message": "正在分析需求…" }
{ "type": "tool_call",       "tool": "update_project", "args": ["project_id", "client_name", "project_name"] }
{ "type": "project_updated", "project": { ...ProjectResponse } }
{ "type": "text",            "delta": "..." }
{ "type": "ca_reply",        "content": "...", "actions_taken": [...], "intent_json": {...} }
{ "type": "done" }
{ "type": "error",           "message": "..." }
```

行为：
1. 先创建 stub 项目，`client_name="待 CA 解析"`，`project_name` = 首条消息第一行的前 40 字
2. CA system prompt 强制要求第一个动作是 `update_project`，把 stub 字段回填为真实值
3. CA 流式回复（文本 delta + 工具调用事件）
4. 全部结束发 `done` 后关闭连接

---

## Conversations & Threads（项目级）

### POST /api/projects/{id}/chat
同步对话。
```json
// request
{ "message": "...", "thread_id": "uuid-或-null" }
// response
{
  "reply": "我已经为您搜索了...",
  "intent_json": { "action": "search_talent_pool", "params": {...} },
  "actions_taken": ["search_talent_pool: ['query', 'location']"],
  "conversation_id": "uuid"
}
```

### POST /api/projects/{id}/chat/stream
**SSE 流式**对话（推荐默认通路）。请求体同上。响应是 `text/event-stream`，
每条事件形如：
```
data: {"type": "tool_call", "name": "search_talent_pool", "label": "正在搜索人才池…"}

data: {"type": "text", "delta": "我"}

data: {"type": "text", "delta": "找到"}

data: {"type": "done", "reply_text": "...", "actions_taken": [...], "intent_json": null, "conversation_id": "..."}
```

### GET /api/projects/{id}/conversations?thread_id=&skip=&limit=
对话历史（按时间正序）。不传 `thread_id` 返回所有历史；传 UUID 按 thread 过滤。

### POST/GET/PATCH/DELETE /api/projects/{id}/threads
对话 thread 的 CRUD：
- `GET` 返回真实 thread，**追加**一条 `is_legacy: true` 的合成 thread 表示
  `thread_id IS NULL` 的历史消息（只有当确实存在 legacy 消息时才追加）
- `POST` 创建：`{ "name": "新对话" }`
- `PATCH` 重命名：`{ "name": "..." }`
- `DELETE` 删除（关联的 `conversation_logs.thread_id` 会被 `SET NULL`，变成 legacy）

---

## Candidates

### POST /api/candidates
插入候选人。后台自动：
1. 计算 `confidence_score`
2. 触发 EmbeddingService 把 chunked 内容写入 LanceDB `candidate_embeddings`

请求体见 `CandidateCreate` schema。最常见字段：
`full_name`, `current_title`, `current_company`, `location`,
`years_experience`, `salary_range`, `education`, `linkedin_url`,
`liepin_url`, `phone`, `email`, `experience_summary`, `raw_structured_data`,
`source_platform`。

### GET /api/candidates?skip=&limit=&location=&min_years=&max_years=&company=
简易筛选 + 分页。

### GET / PATCH / DELETE /api/candidates/{id}
单条 CRUD。PATCH 时若改了任一索引字段
（`full_name`, `current_title`, `current_company`, `location`,
`years_experience`, `education`, `experience_summary`, `raw_structured_data`），
后台自动重新向量化。

### GET /api/candidates/{id}/evaluations
返回该候选人在**所有项目**里的历史评估结果（`ProjectCandidate[]`）。

### POST /api/candidates/search
**混合检索**（SQL 硬过滤 + FTS5 + LanceDB 向量 + RRF 融合）。
```json
{
  "query": "有大模型部署经验的技术总监，熟悉vLLM和TensorRT",
  "location": "新加坡",
  "min_years_experience": 8,
  "max_years_experience": 15,
  "current_company": null,
  "exclude_query": "纯学术研究背景",
  "exclude_companies": ["XX 老东家"],
  "source_platform": null,
  "limit": 20
}
```

**检索流程**（详见 `services/search_service.py`）：
1. **identifier 短路**：query 看起来像手机号/邮箱/LinkedIn URL/猎聘 URL → SQL 精确匹配，直接返回
2. **SQL 硬过滤** → 集合 A
3. **并行召回**：FTS5 BM25 → 排名 B；LanceDB 余弦 → 排名 C（按 chunk 最近距离归并到 candidate）
4. **RRF (k=60)** 融合 B + C；若集合 A 非空则取交集
5. **可选语义排除**：`exclude_query` embed 后过滤距离 < 0.45 的候选人
6. **min-max 归一到 [0, 100]**，命中所有 SQL 过滤的候选人额外 +10 bonus

响应：
```json
[
  {
    "candidate": { ...CandidateResponse },
    "sql_matched": true,
    "vector_score": 0.18,
    "combined_score": 92.4
  }
]
```

### POST /api/candidates/rewrite-query
LLM 把自由文本拆成结构化过滤 + 语义残余。
```json
// request
{ "query": "上海做新能源汽车 BMS 算法 5 年以上的，最好华为系" }
// response
{
  "filters": { "location": "上海", "min_years_experience": 5, "current_company": "华为" },
  "semantic_remainder": "新能源汽车 BMS 算法",
  "used_llm": true
}
```
简单查询（纯关键词 / 短名 / 标识符）会走规则门，`used_llm: false`，跳过 LLM。
前端可以根据 `used_llm` 显示「智能搜索已启用」徽标。

---

## Evaluations

### POST /api/projects/{id}/evaluate/{cid}?source_list_id=<uuid>
触发 EA 评估（**202 Accepted**，detached `asyncio.create_task`）。

- 预建 `project_candidate` 记录（`status=pending`），并清空旧评估输出，
  这样前端能立即看到「评估中」状态而不是上一次的旧分数。
- 可选 `source_list_id`：表示从 talent list 推过来的，会**原子地**把对应
  `talent_list_member.status` 推进到 `added_to_project`；
  list 不包含该候选人时返 404，避免出现「promoted 但 list 里没人」的脏状态。

响应：
```json
{
  "message": "Evaluation triggered",
  "project_id": "uuid",
  "candidate_id": "uuid",
  "status_url": "/api/projects/{project_id}/candidates/{candidate_id}/status",
  "poll_interval_seconds": 5
}
```

EA 评估时读取：
- 项目 `requirement_profile`
- 候选人 profile
- 该项目所有 `preference_logs`（权重调整 / positive / negative signal）
- `industry_knowledge` 中与项目语义相近的知识块（RAG）

EA 输出：`match_score`（总分 0-100）+ `dimension_scores`（各维度 JSON）+
`recommendation`（推荐理由）+ `risk_flags`（风险提示）。

### GET /api/projects/{id}/candidates/{cid}/status
轮询评估状态。
```json
{
  "project_id": "uuid",
  "candidate_id": "uuid",
  "is_complete": true,
  "status": "recommended",
  "match_score": 85.5,
  "evaluated_at": "2026-05-24T10:30:00Z",
  "poll_interval_seconds": 5
}
```
评估完成后调 `GET /projects/{id}/candidates` 拿完整结果。

### GET /api/projects/{id}/candidates
项目下所有关联候选人 + 评估结果。

### POST /api/projects/{id}/candidates/{cid}/link
**不触发评估**，只建立 `project_candidate` 关联。用于手动把候选人挂到项目，
后续再触发 EA。

### PATCH /api/projects/{id}/candidates/{cid}
更新业务状态 / hunter_feedback：
```json
{ "status": "eliminated", "hunter_feedback": "技术不错但管理经验不足" }
```

| status 值 | 含义 |
|-----------|------|
| pending | 待评估（EA 未跑完） |
| recommended | 已推荐给客户 |
| eliminated | 已淘汰 |
| interviewed | 已安排面试 |
| failed | EA 评估失败（exception） |

---

## Preferences

### POST /api/projects/{id}/preferences
记录猎头偏好。CA 工具 `update_preference` 也走这个端点。
```json
{
  "candidate_id": "uuid（可选）",
  "feedback_type": "weight_adjustment",
  "hunter_comment": "这个人技术够了但管理经验太少",
  "weight_adjustment": { "管理经验": 15, "技术深度": -5 }
}
```

| feedback_type | 含义 |
|---|---|
| weight_adjustment | 权重调整 |
| positive_signal | 正向信号（好候选人特征） |
| negative_signal | 负向信号（不要的特征） |
| general | 一般反馈 |

### GET /api/projects/{id}/preferences
列表。

---

## Research

### POST /api/projects/{id}/research
触发 RA（**202 Accepted**，BackgroundTask）。
```json
{ "topic": "储能行业", "additional_context": "重点关注逆变器和电池管理系统方向" }
```

RA 内部流程：**Plan → Search → Synthesize**
1. **Plan**：LLM 生成 5-`TAVILY_MAX_QUERIES`（默认 8）个搜索查询
2. **Search**：Tavily `auto_parameters=True` 并行抓取
3. **Synthesize**：LLM 输出三件套
   - Markdown 报告 → 写到 `projects/<name>/reports/<id>_<topic>_<ts>.md`
   - 结构化 ontology → 写入 `skill_ontology`
   - 知识块 → embed 后写入 `industry_knowledge`

> RA 需要 `TAVILY_API_KEY`。未配置时端点会失败，并把错误写进 `project_research.status='failed'`。

### GET /api/projects/{id}/research
该项目所有调研记录。

### GET /api/projects/{id}/research/{rid}/report
返回 Markdown 报告正文：
```json
{ "content": "# 储能行业...", "path": "/Users/.../projects/.../reports/xxx.md" }
```
> 路径校验：只允许读 `eagle_dir()` 或该项目 `folder_path` 之下的文件，防止路径遍历。

---

## Ontology

### GET /api/ontology?skip=&limit=
列出所有 ontology 条目。

### GET /api/ontology/{id}
单条详情：
```json
{
  "id": "uuid",
  "industry": "人工智能",
  "concept": "大模型部署 (LLM Deployment)",
  "synonyms": ["模型推理", "Inference", "端侧部署"],
  "tech_stack": ["vLLM", "TensorRT-LLM", "TGI", "Ollama"],
  "prerequisites": ["CUDA编程", "C++", "Python架构"],
  "key_positions": ["大模型部署工程师", "推理优化工程师"],
  "skill_relations": { "Model Serving": ["Docker", "Kubernetes"] },
  "jargon": { "Serving": "模型服务", "Inference": "模型推理" },
  "created_at": "...",
  "updated_at": "..."
}
```

---

## Talent（多格式简历录入）

`/api/talent/*` 由 **Talent Agent (TA)** 提供，与 CA/RA/EA 平级，直接给前端用，不经过 CA 编排。

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/talent/parse-images`   | POST (multipart) | Vision LLM 解析图片简历截图。`batch_mode=true` 时每张图视为独立候选人 |
| `/api/talent/parse-document` | POST (multipart) | 上传 PDF / Word，服务端抽文字后由 LLM 结构化 |
| `/api/talent/parse-text`     | POST | 提交纯文字（微信复制等） |
| `/api/talent/extract-doc`    | POST (multipart) | **不调 LLM**，只把 PDF / Word 抽成纯文本返回，给前端预览用 |
| `/api/talent/check-duplicates` | POST | 仅查重不写库 |
| `/api/talent/confirm-import` | POST | 前端确认后批量写库，每条独立选择 `create` / `overwrite` / `skip` |

**查重逻辑优先级**：手机号精确 → 邮箱精确 → 姓名 + 公司模糊匹配。

**Vision 兼容**：图片解析要求 LLM 支持 Vision；不支持时返回用户可读错误（不抛 500）。
PDF/Word/文字模式用普通 LLM 即可。

---

## Talent Lists（跨项目人才清单）

### GET /api/talent-lists?project_id=&unassigned=
- 不传参数：所有清单
- 传 `project_id`：仅该项目下绑定的清单
- 传 `unassigned=true`：仅孤儿清单（`project_id IS NULL`）
- 二者互斥，同时传 400

### POST /api/talent-lists
```json
{
  "name": "新加坡 AI 部署专家初筛池",
  "project_id": "uuid-或-null",
  "filters_json": { ...CandidateSearchRequest快照 },
  "source": "manual"
}
```

### GET /api/talent-lists/{id}
详情 + 成员（含每个 candidate 的 join 数据）。

### PATCH /api/talent-lists/{id}
改 name / project_id / filters_json。

### DELETE /api/talent-lists/{id}
级联删除成员。

### POST /api/talent-lists/{id}/members
批量加成员：`{ "candidate_ids": ["uuid", "uuid", ...] }`。
重复加同一个候选人不会报错（唯一约束兜底，幂等）。

### PATCH /api/talent-lists/{id}/members/{cid}
改 outreach 状态 / hunter_note：
```json
{ "status": "scheduled", "hunter_note": "周三下午 3 点电话沟通" }
```
状态枚举：`not_contacted` / `contacted` / `scheduled` / `declined` / `added_to_project`。

### DELETE /api/talent-lists/{id}/members/{cid}
移除成员。
