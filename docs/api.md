# Eagle Backend API 文档

## 基本信息

- **Base URL**: `http://localhost:52777`
- **API 前缀**: `/api`
- **文档 UI**: http://localhost:52777/docs (Swagger) | http://localhost:52777/redoc

## 认证

除 `/api/health` 外，所有接口需在 HTTP Header 中携带：

```
X-API-Key: your-secret-api-key
```

错误响应（未认证）：
```json
{ "detail": "Invalid or missing API key. Provide it in the X-API-Key header." }
```

---

## System

### GET /api/health

健康检查，无需认证。

**响应：**
```json
{ "status": "healthy", "service": "Eagle API" }
```

---

## Projects（项目管理）

### POST /api/projects

创建新招聘项目。如提供 `requirement_profile`，将在后台自动向量化。

**请求体：**
```json
{
  "client_name": "某科技公司",
  "project_name": "技术VP招募",
  "jd_raw": "我们需要一位有大模型部署经验的技术VP...",
  "requirement_profile": {
    "location": "新加坡",
    "experience_years": "8-15",
    "hard_skills": ["LLM部署", "团队管理"],
    "salary_range": "50-80万"
  },
  "mode": "precise"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| client_name | string | ✅ | 客户公司名 |
| project_name | string | ✅ | 项目名称 |
| jd_raw | string | ❌ | 原始职位描述文本 |
| requirement_profile | object | ❌ | 结构化需求画像 (JSONB) |
| mode | string | ❌ | `precise` 或 `explore`，默认 `precise` |

**响应 201：**
```json
{
  "id": "uuid",
  "client_name": "某科技公司",
  "project_name": "技术VP招募",
  "jd_raw": "...",
  "requirement_profile": {...},
  "mode": "precise",
  "status": "active",
  "created_at": "2026-03-31T10:00:00Z",
  "updated_at": "2026-03-31T10:00:00Z"
}
```

---

### GET /api/projects

列出所有项目（分页）。

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| skip | int | 0 | 跳过条数 |
| limit | int | 20 | 返回条数 |

**响应 200：** `Project[]`

---

### GET /api/projects/{project_id}

获取单个项目详情。

**响应 200：** `Project` | **404** 项目不存在

---

### PATCH /api/projects/{project_id}

更新项目信息（部分更新）。更新 `requirement_profile` 时自动重新向量化。

**请求体（所有字段可选）：**
```json
{
  "requirement_profile": {"location": "全球"},
  "mode": "explore",
  "status": "completed"
}
```

**响应 200：** `Project` | **404** 项目不存在

---

## Candidates（候选人管理）

### POST /api/candidates

添加候选人到全局人才池。候选人创建后自动：
1. 计算信息置信度评分
2. 在后台向量化 `experience_summary`

**请求体：**
```json
{
  "full_name": "张三",
  "current_title": "AI平台负责人",
  "current_company": "某AI独角兽",
  "location": "新加坡",
  "years_experience": 10.0,
  "salary_range": "60-80万",
  "education": "清华大学 计算机 博士",
  "linkedin_url": "https://linkedin.com/in/...",
  "liepin_url": "https://www.liepin.com/...",
  "raw_structured_data": {
    "current_tenure_months": 18,
    "skills": ["vLLM", "TensorRT", "Kubernetes"],
    "open_to_work": false
  },
  "experience_summary": "10年AI基础设施经验，曾主导某大厂推理优化平台从0到1，管理20人团队...",
  "source_platform": "linkedin"
}
```

**信息置信度评分算法：**
- 基准：100 分
- 每月衰减：-5 分
- 任期 30-40 月（期权兑现期）：+20 分（高异动可能）
- 任期 < 12 月（刚入职）：-30 分（难以被挖）
- < 60 分：标记 `⚠️ 信息可能过时 / 需激活`

**响应 201：** `Candidate`

---

### GET /api/candidates

列出候选人（支持 SQL 过滤）。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| location | string | 地点模糊匹配 |
| min_years | float | 最少工作年限 |
| max_years | float | 最多工作年限 |
| company | string | 公司名模糊匹配 |
| skip | int | 分页偏移 |
| limit | int | 返回数量 |

**响应 200：** `Candidate[]`

---

### GET /api/candidates/{candidate_id}

获取候选人详情。

**响应 200：** `Candidate` | **404**

---

### POST /api/candidates/search

混合检索（并行 SQL + 向量语义搜索）。

**请求体：**
```json
{
  "query": "有大模型部署经验的技术总监，熟悉vLLM和TensorRT",
  "location": "新加坡",
  "min_years_experience": 8,
  "max_years_experience": 15,
  "limit": 20,
  "offset": 0
}
```

**搜索逻辑：**
1. SQL 过滤：硬性条件（location, years_experience, company）
2. 向量搜索：对 `query` 进行 embedding，与 `candidate_embeddings` 做余弦距离搜索
3. 两路**并行执行**，结果合并去重，统一计算 `combined_score` 后降序返回

**combined_score 计算公式（0-100，越高越好）：**

```
sql_bonus   = 40  （通过所有 SQL 硬性过滤条件）
vector_part = (1 - cosine_distance) × 60  （语义相关度，余弦距离越低越高）
combined_score = sql_bonus + vector_part   （上限 100）
```

| 场景 | combined_score |
|------|---------------|
| 仅 SQL 命中（无 query 文本） | 40.0 |
| 仅向量命中，距离 0.1 | 54.0 |
| 两路均命中，距离 0.2 | 88.0 |
| 两路均命中，距离 0.0（完美） | 100.0 |

**响应 200：**
```json
[
  {
    "candidate": { ...CandidateResponse },
    "sql_matched": true,
    "vector_score": 0.2,
    "combined_score": 88.0
  }
]
```

> - `vector_score`：pgvector 余弦距离（0 = 完全相同，1 = 正交，越低越相关）
> - `combined_score`：**前端应按此字段降序展示**

---

## Evaluations（评估）

### POST /api/projects/{project_id}/evaluate/{candidate_id}

触发 EA 对候选人进行评估（异步后台执行，立即返回 202）。

触发时会预建 `project_candidate` 记录（`status=pending`），插件端可**立即开始轮询**状态端点。

**响应 202：**
```json
{
  "message": "Evaluation triggered",
  "project_id": "uuid",
  "candidate_id": "uuid",
  "status_url": "/api/projects/{project_id}/candidates/{candidate_id}/status",
  "poll_interval_seconds": 5
}
```

EA 评估包括：
- 多维度评分（技能匹配、经验年限、地点、行业背景、管理经验、薪资）
- 权重自动读取该项目的 `preference_logs`
- 行业知识上下文（从 `industry_knowledge` 向量搜索）
- 输出：总体 match_score、各维度分数、推荐理由、风险提示

---

### GET /api/projects/{project_id}/candidates/{candidate_id}/status

轮询评估状态。触发评估后每隔 5 秒调用此端点，直到 `is_complete=true`。

**响应 200：**
```json
{
  "project_id": "uuid",
  "candidate_id": "uuid",
  "is_complete": false,
  "status": "pending",
  "match_score": null,
  "evaluated_at": null,
  "poll_interval_seconds": 5
}
```

评估完成后：
```json
{
  "project_id": "uuid",
  "candidate_id": "uuid",
  "is_complete": true,
  "status": "recommended",
  "match_score": 85.5,
  "evaluated_at": "2026-03-31T10:30:00Z",
  "poll_interval_seconds": 5
}
```

**轮询流程：**
```
POST /evaluate/{candidate_id}  →  202 (含 status_url)
    ↓ 每 5 秒
GET /candidates/{candidate_id}/status  →  is_complete=false
    ↓ ...
GET /candidates/{candidate_id}/status  →  is_complete=true  →  停止轮询
GET /candidates  →  获取完整评估结果（含 recommendation、dimension_scores 等）
```

**404**：若未触发过评估则返回 404，需先调用触发接口。

---

### GET /api/projects/{project_id}/candidates

获取项目下所有候选人及评估结果。

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| sort_by_score | bool | true | 按 match_score 降序排列 |

**响应 200：**
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "candidate_id": "uuid",
    "match_score": 85.5,
    "dimension_scores": {
      "技能匹配": 90,
      "经验年限": 85,
      "地点匹配": 100,
      "行业背景": 80,
      "管理经验": 75,
      "薪资匹配": 85
    },
    "recommendation": "张三拥有10年AI基础设施经验，曾主导推理优化平台建设...",
    "risk_flags": "管理团队规模待确认，建议深挖其在50人以上团队的经验",
    "hunter_feedback": null,
    "status": "recommended",
    "evaluated_at": "2026-03-31T10:30:00Z",
    "candidate": { ...CandidateResponse }
  }
]
```

---

### PATCH /api/projects/{project_id}/candidates/{candidate_id}

更新候选人在项目中的状态或猎头反馈。

**请求体：**
```json
{
  "status": "eliminated",
  "hunter_feedback": "技术不错但管理经验不足"
}
```

| status 值 | 含义 |
|-----------|------|
| pending | 待评估 |
| recommended | 已推荐给客户 |
| eliminated | 已淘汰 |
| interviewed | 已安排面试 |

**响应 200：** `ProjectCandidate`

---

## Conversations（对话）

### POST /api/projects/{project_id}/chat

与 Coordinator Agent 对话。CA 会根据上下文执行工具（搜索、评估、调研等）并返回。

**请求体：**
```json
{ "message": "帮我找几个在新加坡的AI部署专家，5年以上经验" }
```

**响应 200：**
```json
{
  "reply": "我已经为您搜索了新加坡地区的AI部署专家，找到以下3位候选人...",
  "intent_json": {
    "action": "search_talent_pool",
    "params": { "location": "新加坡", "query": "AI部署专家", "min_years_experience": 5 }
  },
  "actions_taken": ["search_talent_pool: ['query', 'location', 'min_years_experience']"]
}
```

---

### GET /api/projects/{project_id}/conversations

获取项目对话历史（按时间正序）。

**查询参数：** `skip`, `limit`（默认 50）

**响应 200：** `ConversationLog[]`

---

## Preferences（偏好管理）

### POST /api/projects/{project_id}/preferences

记录猎头的偏好反馈（通常由 CA 自动调用，也可手动添加）。

**请求体：**
```json
{
  "candidate_id": "uuid（可选）",
  "feedback_type": "weight_adjustment",
  "hunter_comment": "这个人技术够了但管理经验太少",
  "weight_adjustment": { "管理经验": 15, "技术深度": -5 }
}
```

| feedback_type | 含义 |
|---------------|------|
| weight_adjustment | 权重调整 |
| positive_signal | 正向信号（好候选人特征） |
| negative_signal | 负向信号（不要的特征） |
| general | 一般反馈 |

**响应 201：** `PreferenceLog`

---

### GET /api/projects/{project_id}/preferences

列出项目的所有偏好记录。

**响应 200：** `PreferenceLog[]`

---

## Research（行业调研）

### POST /api/projects/{project_id}/research

触发 Research Agent 进行行业调研（异步后台执行）。

RA 使用 Claude 内置 `web_search` tool 搜索最新信息，产出：
1. Markdown 报告（存储到文件系统）
2. 结构化技能图谱（存储到 `skill_ontology` 表）
3. 向量化知识块（存储到 `industry_knowledge` 表，供 EA 使用）

**请求体：**
```json
{
  "topic": "储能行业",
  "additional_context": "重点关注逆变器和电池管理系统方向"
}
```

**响应 202：**
```json
{
  "message": "Research triggered",
  "project_id": "uuid",
  "topic": "储能行业"
}
```

---

### GET /api/projects/{project_id}/research

获取项目的调研记录列表。

**响应 200：**
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "ontology_id": "uuid",
    "report_file_path": "reports/uuid_储能行业_20260331_103000.md",
    "created_at": "2026-03-31T10:30:00Z",
    "ontology": { ...OntologyResponse }
  }
]
```

---

## Ontology（技能图谱）

### GET /api/ontology

列出行业技能图谱条目。

**查询参数：** `industry`（模糊匹配）, `skip`, `limit`

**响应 200：** `OntologyResponse[]`

---

### GET /api/ontology/{ontology_id}

获取单个技能图谱详情。

**响应 200：**
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
  "created_at": "2026-03-31T09:00:00Z",
  "updated_at": "2026-03-31T09:00:00Z"
}
```
