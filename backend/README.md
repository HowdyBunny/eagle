# Eagle Backend

Eagle 后端服务，为猎头提供 Agentic AI 人才搜寻能力。基于 FastAPI，使用 SQLite（含 FTS5 全文索引） + LanceDB 实现混合检索，支持 OpenAI / Anthropic 双 LLM Provider 驱动四个核心 Agent。

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI + Uvicorn |
| 实时通讯 | SSE（CA 流式回复）+ WebSocket（项目 bootstrap） |
| 数据库 ORM | SQLAlchemy 2.0 async + aiosqlite |
| 全文索引 | SQLite FTS5（candidates_fts 虚拟表，BM25 排序） |
| 向量搜索 | LanceDB（本地文件，余弦距离） |
| 排序融合 | Reciprocal Rank Fusion（k=60） |
| 数据库迁移 | Alembic（应用启动时自动 `upgrade head`） |
| LLM (Agent) | OpenAI / Anthropic（通过 `LLM_PROVIDER` 切换） |
| Web Search | Tavily（Research Agent 用） |
| Embedding | OpenAI 兼容 API（默认 `text-embedding-3-small`，1536 维） |
| 配置管理 | pydantic-settings + 运行时热更新 |
| 日志 | loguru（控制台 + `logs/eagle.log`，轮转 7 天） |
| 包管理 | uv |

## 项目结构

```
backend/
├── app/
│   ├── main.py           # FastAPI 应用入口（含启动时自动迁移 + LanceDB schema 校验）
│   ├── config.py         # 环境配置 (pydantic-settings)
│   ├── database.py       # 数据库引擎和会话
│   ├── models/           # SQLAlchemy ORM 模型（10 张表，见下文）
│   ├── schemas/          # Pydantic 请求/响应模型
│   ├── api/              # FastAPI 路由（按资源拆分）
│   ├── services/         # 业务逻辑层（搜索 / Embedding / Tavily / Ontology / ...）
│   ├── agents/           # CA / RA / EA / TA Agent 实现 + CA 工具表
│   └── utils/            # 工具函数 (logger, paths 等)
├── alembic/              # 数据库迁移
├── alembic.ini
├── pyproject.toml
├── eagle-backend.spec    # PyInstaller 打包配置（生成 Tauri sidecar）
├── .env.example
└── main.py               # uvicorn 启动入口
```

> **注意**：后端目前**没有 auth 中间件**。早期版本曾基于 `X-API-Key` 做认证，已移除（参见 `c1a2b3d4e5f6` 之前的版本）。当前仅靠 `CORS_ORIGINS` 与 `localhost` 监听做隔离。如需重新引入认证，应在 `app/main.py` 注册中间件。

## 环境要求

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) 包管理器
- LLM API Key（OpenAI 或 Anthropic）
- Embedding API Key（OpenAI 兼容端点）
- Tavily API Key（仅 Research Agent 需要；不配置 RA 不可用，其他 Agent 不受影响）

> **无需 Docker**：SQLite 和 LanceDB 均为本地文件存储，无需外部数据库服务。

## 快速开始

### 1. 安装依赖

```bash
cd backend
uv sync
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入：

```env
# LLM Provider 选择："openai" 或 "anthropic"
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-5.2
# LLM_BASE_URL=https://your-provider.example.com/v1  # 可选，openai 带 /v1，anthropic 不带

# Tavily（Research Agent 网页搜索）
TAVILY_API_KEY=tvly-...
# TAVILY_MAX_QUERIES=8   # 计划阶段最多 emit 多少个查询，默认 8

# Embedding（OpenAI 兼容端点）
EMBEDDING_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
# EMBEDDING_BASE_URL=https://your-provider.example.com/v1  # 可选
```

> **使用非官方 API**：取消注释对应的 `*_BASE_URL` 行并填入地址即可。兼容 Azure OpenAI、本地 Ollama、第三方转发服务等。
> **运行时热更新**：上面这些字段也可以在打包应用启动后从前端「设置」页填写，会通过 `PUT /api/settings` 热更新并写回 `~/Desktop/Eagle/.env`，无需重启进程。

### 3. 数据库迁移（通常不需要手动跑）

应用启动时（`app/main.py` 的 `lifespan`）会自动执行 `alembic upgrade head`，并校验 LanceDB 表的向量维度是否与 `EMBEDDING_DIMENSIONS` 匹配。手动操作：

```bash
uv run alembic upgrade head          # 应用所有迁移
uv run alembic downgrade -1          # 回滚一步
uv run alembic current               # 查看当前迁移状态
uv run alembic revision --autogenerate -m "description"  # 生成新迁移
```

### 4. 启动服务

**开发模式（热重载）：**

```bash
uv run python main.py --dev
```

**生产模式：**

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 52777 --workers 4
```

服务启动后访问：
- API 文档：http://localhost:52777/docs
- 健康检查：http://localhost:52777/api/health

## 文件存储结构

Eagle 在用户桌面创建统一的数据目录（首次启动时自动创建）：

```
~/Desktop/Eagle/
├── projects/                         ← 猎头项目文件夹
│   ├── 2026-03-某科技/               ← 创建项目时自动生成（YYYY-MM-客户名）
│   │   └── reports/                  ← RA 生成的 Markdown 调研报告
│   └── 2026-03-另一客户-a1b2c3d4/
├── data/
│   ├── eagle.db                      ← SQLite 数据库（含 FTS5 虚拟表）
│   └── lancedb/                      ← LanceDB 向量数据库（本地文件）
└── .env                              ← 前端 Settings 热更新写入这里
```

> **Windows 用户**：将 `EAGLE_BASE_DIR` 设置为 `C:/Users/<你的用户名>/Desktop/Eagle`。

## 数据库结构

### SQL 表（SQLite，10 张 + 1 个 FTS5 虚拟表）

| 表名 | 说明 |
|------|------|
| `projects` | 猎头招聘项目（`mode` 列已废弃，见迁移 `c1a2b3d4e5f6`） |
| `candidates` | 全局人才池（含 `phone` / `email` / `school_canonical` 等） |
| `candidates_fts` | FTS5 虚拟表，对 candidates 做 BM25 全文检索（迁移 `e5f6a7b8c9d0`） |
| `project_candidates` | 项目-候选人关联 + EA 评估结果（`trigger_source` / `llm_raw_output` 见迁移 `99c6c81aed9f`） |
| `preference_logs` | 猎头偏好反馈记录 |
| `skill_ontology` | RA 产出的行业技能图谱 |
| `project_research` | 项目-调研结果关联（含 RA Markdown 报告路径） |
| `conversation_logs` | CA 对话历史，可关联到 `conversation_threads` |
| `conversation_threads` | 项目下的多线程对话（迁移 `d2e3f4a5b6c7`） |
| `talent_lists` | 跨项目复用的候选人清单（迁移 `a1b2c3d4e5f7`） |
| `talent_list_members` | 清单成员 + outreach 状态（not_contacted / contacted / scheduled / declined / added_to_project） |

### LanceDB Collections（3 个）

| Collection | 说明 |
|------------|------|
| `candidate_embeddings` | 候选人 chunked embeddings（姓名 / 职位 / 公司 / 学校 / 经历混合分块） |
| `requirement_embeddings` | 项目需求向量 |
| `industry_knowledge` | RA 行业知识向量块（供 EA 软匹配 + RAG） |

启动时 `validate_schemas()` 会校验现有 LanceDB 表的向量维度是否与 `EMBEDDING_DIMENSIONS` 一致，不一致会**自动 drop 重建**（数据丢失），通常发生在切换 Embedding 模型时。

## Agent 说明

| Agent | 文件 | 说明 |
|-------|------|------|
| **Coordinator Agent (CA)** | `app/agents/coordinator.py` | 对话层 + 编排层。LLM tool-use 循环，支持 `chat`（同步）与 `chat_stream`（SSE） |
| **Research Agent (RA)** | `app/agents/research.py` | 行业调研。Plan→Search→Synthesize 三段：LLM 计划查询 → **Tavily** 并行抓取（`auto_parameters=True`）→ LLM 合成 XML 标签结构化输出 |
| **Evaluator Agent (EA)** | `app/agents/evaluator.py` | 候选人多维度评分。读取项目 `preference_logs` 调整权重，从 `industry_knowledge` RAG 补行业上下文 |
| **Talent Agent (TA)** | `app/agents/talent.py` | 候选人录入：图片/PDF/Word/文字解析、查重检测、批量写库 |

### CA 工具表（OpenAI function-calling）

| 工具名 | 用途 |
|---|---|
| `update_project` | 把 stub 占位项目的 `client_name` / `project_name` 等字段回填为真实值 |
| `clarify_requirement` | 写入 / 更新 `requirement_profile`，触发后台重新向量化 |
| `search_talent_pool` | 调用 SearchService 做 SQL + FTS + 向量混合检索 |
| `trigger_evaluation` | 触发 EA 评估单个候选人（detached asyncio task） |
| `request_industry_research` | 触发 RA 调研（后台 task，先返 202 给前端） |
| `update_preference` | 写入 `preference_logs`，可以带 `weight_adjustment` |

### Talent Agent (TA) — 端点说明

TA 通过 `/api/talent/` 前缀对外暴露，与 CA/RA/EA 平级，直接服务前端用户操作，不经过 CA 编排。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/talent/parse-images` | POST | 上传图片截图（multipart），Vision LLM 解析候选人信息。`batch_mode=true` 时每张图视为独立候选人 |
| `/api/talent/parse-document` | POST | 上传 PDF 或 Word 文件，服务端提取文字后由 LLM 结构化 |
| `/api/talent/parse-text` | POST | 提交纯文字（如从微信复制的简历），由 LLM 结构化 |
| `/api/talent/extract-doc` | POST | 不调用 LLM，仅服务端把 PDF/Word 抽成纯文本返回 |
| `/api/talent/check-duplicates` | POST | 仅查重（不写库），返回每条候选记录命中的现有候选人 |
| `/api/talent/confirm-import` | POST | 前端确认后批量写入人才库，每条独立选择 `create` / `overwrite` / `skip` |

**查重逻辑优先级**：手机号精确匹配 → 邮箱精确匹配 → 姓名 + 公司模糊匹配。

**视觉模型兼容**：图片解析要求 LLM 支持 Vision 能力（如 `gpt-4o`、`claude-3.5-sonnet`）。若模型不支持，TA 返回用户可读的错误信息而非抛出异常。PDF/Word/文字模式不需要 Vision 能力，使用常规文字 LLM 即可。

## API 路由总览

完整 OpenAPI 定义见 `/docs`。下表只列出资源前缀；具体方法详情参见 [docs/api.md](../docs/api.md) 或 Swagger UI。

| 前缀 | 文件 | 主要资源 |
|---|---|---|
| `/api/health` | `api/health.py` | 健康检查 |
| `/api/errors` | `api/errors.py` | 前端 JS 异常上报（写入 `logs/eagle.log`） |
| `/api/settings` | `api/settings.py` | LLM/Embedding 运行时热更新 (GET / PUT)，自动写回 `.env` |
| `/api/projects` | `api/projects.py` | 项目 CRUD |
| `/api/projects/{id}/chat` | `api/conversations.py` | CA 对话（同步） |
| `/api/projects/{id}/chat/stream` | `api/conversations.py` | CA SSE 流式回复 |
| `/api/projects/{id}/conversations` | `api/conversations.py` | 对话历史（按 thread 过滤） |
| `/api/projects/{id}/threads` | `api/threads.py` | 项目下的对话 thread CRUD |
| `/api/projects/{id}/research` | `api/research.py` | 触发 / 列表 / 读取 RA 报告 |
| `/api/projects/{id}/evaluate/{cid}` | `api/evaluations.py` | 触发 EA 评估（detached asyncio task） |
| `/api/projects/{id}/candidates` | `api/evaluations.py` | 项目下候选人列表 + 评估结果 |
| `/api/projects/{id}/preferences` | `api/preferences.py` | 偏好记录 |
| `/api/candidates` | `api/candidates.py` | 候选人 CRUD + 评估历史 |
| `/api/candidates/search` | `api/candidates.py` | 混合搜索（SQL + FTS + 向量 + RRF） |
| `/api/candidates/rewrite-query` | `api/candidates.py` | LLM 把自由文本拆成过滤条件 + 语义残余 |
| `/api/talent/*` | `api/talent.py` | TA 多格式录入（见上表） |
| `/api/talent-lists` | `api/talent_lists.py` | 人才清单 CRUD |
| `/api/talent-lists/{id}/members` | `api/talent_lists.py` | 清单成员管理 + outreach 状态 |
| `/api/ontology` | `api/ontology.py` | 行业 ontology 查询 |
| **WS** `/api/projects/bootstrap` | `api/ws_bootstrap.py` | 一次 WebSocket 完成「建 stub 项目 + 首次 CA 解析 + push 项目元数据」 |

## 日志

日志同时输出到：
- 控制台（彩色格式）
- `logs/eagle.log`（自动轮转，保留 7 天）
- 前端通过 `POST /api/errors` 上报的 JS 异常（`window.onerror` / `unhandledrejection`）也会落到这里

## 环境变量完整说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `LLM_PROVIDER` | ❌ | `openai` | LLM SDK 类型：`openai` 或 `anthropic` |
| `LLM_API_KEY` | ⚠️ | `None` | LLM 调用密钥。打包应用允许空启动，由前端首次运行时引导填写 |
| `LLM_MODEL` | ❌ | `gpt-5.2` | 使用的 LLM 模型名称 |
| `LLM_BASE_URL` | ❌ | `None`（官方） | 自定义 LLM API 地址 |
| `TAVILY_API_KEY` | ⚠️ | `None` | Tavily Web Search Key；不配则 RA 不可用 |
| `TAVILY_MAX_QUERIES` | ❌ | `8` | RA 计划阶段最多 emit 多少个搜索查询 |
| `EMBEDDING_API_KEY` | ⚠️ | `None` | Embedding API Key；同上，可前端引导填写 |
| `EMBEDDING_MODEL` | ❌ | `text-embedding-3-small` | Embedding 模型 |
| `EMBEDDING_BASE_URL` | ❌ | `None`（官方） | 自定义 Embedding API 地址 |
| `EMBEDDING_DIMENSIONS` | ❌ | `1536` | 向量维度；变更后 LanceDB 旧表会被自动 drop |
| `LOG_LEVEL` | ❌ | `INFO` | 日志级别 |
| `EAGLE_BASE_DIR` | ❌ | `~/Desktop/Eagle` | 数据存储根目录 |
| `CORS_ORIGINS` | ❌ | `["*"]` | 允许的跨域来源列表 |
| `DATABASE_URL` | ❌ | derived | 默认从 `EAGLE_BASE_DIR/data/eagle.db` 推导 |
| `LANCEDB_PERSIST_DIR` | ❌ | derived | 默认从 `EAGLE_BASE_DIR/data/lancedb` 推导 |

> ⚠️ 标注的变量在**首次启动时允许为空**（打包应用引导用），但缺失时对应能力不可用。

## 部署命令汇总

```bash
cd backend
uv sync                              # 安装依赖
cp .env.example .env && vim .env     # 配置环境变量
uv run python main.py --dev          # 启动服务（开发，自动迁移）

# 打包 sidecar 给 Tauri
uv run pyinstaller eagle-backend.spec --noconfirm
```
