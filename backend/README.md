# Eagle Backend

Eagle 后端服务，为猎头提供 Agentic AI 人才搜寻能力。基于 FastAPI 构建，使用 SQLite + ChromaDB 实现混合检索，支持 OpenAI / Anthropic 双 LLM Provider 驱动三个核心 Agent。

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI + Uvicorn |
| 数据库 ORM | SQLAlchemy 2.0 async + aiosqlite |
| 向量搜索 | ChromaDB（本地文件） |
| 数据库迁移 | Alembic |
| LLM (Agent) | OpenAI / Anthropic（通过 `LLM_PROVIDER` 切换） |
| Embedding | OpenAI 兼容 API（text-embedding-3-small） |
| 配置管理 | pydantic-settings |
| 日志 | loguru |
| 包管理 | uv |

## 项目结构

```
backend/
├── app/
│   ├── main.py           # FastAPI 应用入口
│   ├── config.py         # 环境配置 (pydantic-settings)
│   ├── database.py       # 数据库引擎和会话
│   ├── auth.py           # API Key 认证
│   ├── models/           # SQLAlchemy ORM 模型 (7 张表)
│   ├── schemas/          # Pydantic 请求/响应模型
│   ├── api/              # FastAPI 路由
│   ├── services/         # 业务逻辑层
│   ├── agents/           # CA / RA / EA Agent 实现
│   └── utils/            # 工具函数 (logger, paths 等)
├── alembic/              # 数据库迁移
├── alembic.ini
├── pyproject.toml
├── .env.example
└── main.py               # uvicorn 启动入口
```

## 环境要求

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) 包管理器
- LLM API Key（OpenAI 或 Anthropic）
- Embedding API Key（OpenAI 兼容端点）

> **无需 Docker**：SQLite 和 ChromaDB 均为本地文件存储，无需外部数据库服务。

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
LLM_MODEL=gpt-4o
# LLM_BASE_URL=https://your-provider.example.com/v1  # 可选，openai 带 /v1，anthropic 不带

# Web Search（仅 openai Responses API）
WEB_SEARCH_CONTEXT_SIZE=low

# Embedding（OpenAI 兼容端点）
EMBEDDING_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
# EMBEDDING_BASE_URL=https://your-provider.example.com/v1  # 可选

# 后端认证
API_KEY=your-secret-api-key-here
```

> **使用非官方 API**：取消注释对应的 `*_BASE_URL` 行并填入地址即可。兼容 Azure OpenAI、本地 Ollama、第三方转发服务等。

### 3. 执行数据库迁移

```bash
uv run alembic upgrade head
```

### 4. 启动服务

**开发模式（热重载）：**

```bash
uv run python main.py
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
└── data/
    ├── eagle.db                      ← SQLite 数据库
    └── chroma/                       ← ChromaDB 向量数据库（本地文件）
```

> **Windows 用户**：将 `EAGLE_BASE_DIR` 设置为 `C:/Users/<你的用户名>/Desktop/Eagle`。

## 数据库结构

### SQL 表（SQLite，7 张）

| 表名 | 说明 |
|------|------|
| `projects` | 猎头招聘项目 |
| `candidates` | 全局人才池 |
| `project_candidates` | 项目-候选人关联 + EA 评估结果 |
| `preference_logs` | 猎头偏好反馈记录 |
| `skill_ontology` | RA 产出的行业技能图谱 |
| `project_research` | 项目-调研结果关联 |
| `conversation_logs` | CA 对话历史 |

### ChromaDB Collections（3 个）

| Collection | 说明 |
|------------|------|
| `candidate_embeddings` | 候选人工作经历向量 |
| `requirement_embeddings` | 项目需求向量 |
| `industry_knowledge` | RA 行业知识向量块 |

### Alembic 迁移命令

```bash
uv run alembic upgrade head          # 应用所有迁移
uv run alembic downgrade -1          # 回滚一步
uv run alembic current               # 查看当前迁移状态
uv run alembic revision --autogenerate -m "description"  # 生成新迁移
```

## API 认证

所有 API 端点（除 `/api/health`）需要在请求 header 中携带 API Key：

```
X-API-Key: your-secret-api-key-here
```

## Agent 说明

| Agent | 文件 | 说明 |
|-------|------|------|
| **Coordinator Agent (CA)** | `app/agents/coordinator.py` | 对话层 + 编排层，使用 LLM tool use 循环 |
| **Research Agent (RA)** | `app/agents/research.py` | 行业调研，使用 LLM 内置 web_search 能力 |
| **Evaluator Agent (EA)** | `app/agents/evaluator.py` | 候选人多维度评分 |

## 日志

日志同时输出到：
- 控制台（彩色格式）
- `logs/eagle.log`（自动轮转，保留 7 天）

## 环境变量完整说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `LLM_PROVIDER` | ❌ | `openai` | LLM SDK 类型：`openai` 或 `anthropic` |
| `LLM_API_KEY` | ✅ | — | LLM 调用密钥 |
| `LLM_MODEL` | ❌ | `gpt-4o` | 使用的 LLM 模型名称 |
| `LLM_BASE_URL` | ❌ | `None`（官方） | 自定义 LLM API 地址 |
| `WEB_SEARCH_CONTEXT_SIZE` | ❌ | `low` | RA 网页搜索上下文大小（`low` / `medium` / `high`） |
| `EMBEDDING_API_KEY` | ✅ | — | Embedding API Key |
| `EMBEDDING_MODEL` | ❌ | `text-embedding-3-small` | Embedding 模型 |
| `EMBEDDING_BASE_URL` | ❌ | `None`（官方） | 自定义 Embedding API 地址 |
| `EMBEDDING_DIMENSIONS` | ❌ | `1536` | 向量维度，需与模型匹配 |
| `API_KEY` | ✅ | — | 后端认证 Key（`X-API-Key` header） |
| `LOG_LEVEL` | ❌ | `INFO` | 日志级别 |
| `EAGLE_BASE_DIR` | ❌ | `~/Desktop/Eagle` | 数据存储根目录 |
| `CORS_ORIGINS` | ❌ | `["*"]` | 允许的跨域来源列表 |

## 部署命令汇总

```bash
cd backend
uv sync                              # 安装依赖
cp .env.example .env && vim .env      # 配置环境变量
uv run alembic upgrade head           # 执行迁移
uv run python main.py                 # 启动服务（开发）
```
