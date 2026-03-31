# Eagle Backend

Eagle 后端服务，为猎头提供 Agentic AI 人才搜寻能力。基于 FastAPI 构建，集成 PostgreSQL + pgvector 实现混合检索，使用 Anthropic Claude API 驱动三个核心 Agent。

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI + Uvicorn |
| 数据库 ORM | SQLAlchemy 2.0 async + asyncpg |
| 向量搜索 | PostgreSQL + pgvector |
| 数据库迁移 | Alembic |
| LLM (Agent) | Anthropic Claude API |
| Embedding | OpenAI text-embedding-3-small |
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
│   ├── models/           # SQLAlchemy ORM 模型 (7 核心表 + 3 向量表)
│   ├── schemas/          # Pydantic 请求/响应模型
│   ├── api/              # FastAPI 路由
│   ├── services/         # 业务逻辑层
│   ├── agents/           # CA / RA / EA Agent 实现
│   └── utils/            # 工具函数 (logger 等)
├── alembic/              # 数据库迁移
├── alembic.ini
├── pyproject.toml
├── .env.example
└── main.py               # uvicorn 启动入口
```

## 环境要求

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) 包管理器
- Docker & Docker Compose（运行 PostgreSQL）
- Anthropic API Key
- OpenAI API Key（Embedding 用）

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
# 数据库
DATABASE_URL=postgresql+asyncpg://eagle:eagle@localhost:5432/eagle

# Anthropic（驱动 CA / RA / EA）
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
# ANTHROPIC_BASE_URL=https://your-proxy.example.com   # 可选，兼容第三方/自建代理

# OpenAI（仅用于 Embedding）
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
# OPENAI_BASE_URL=https://your-azure-endpoint.openai.azure.com/  # 可选，兼容 Azure/代理

# 后端认证
API_KEY=your-secret-api-key-here
```

> **使用非官方 API**：取消注释对应的 `*_BASE_URL` 行并填入地址即可。所有 Agent 和 Embedding 调用都会走该地址，兼容 Azure OpenAI、本地 Ollama 兼容层、第三方转发服务等场景。

### 3. 启动数据库

```bash
# 在项目根目录（eagle/）
docker compose up -d
```

等待数据库健康检查通过：

```bash
docker compose ps   # 确认 eagle_db 状态为 healthy
```

### 4. 执行数据库迁移

```bash
cd backend
uv run alembic upgrade head
```

### 5. 启动服务

**开发模式（热重载）：**

```bash
uv run python main.py
```

**生产模式：**

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

## 文件存储结构

Eagle 在用户桌面创建统一的数据目录，**首次运行前请确保 `~/Desktop/Eagle` 目录存在**（或修改 `EAGLE_BASE_DIR` 为其他路径）：

```
~/Desktop/Eagle/
├── projects/                         ← 猎头项目文件夹
│   ├── 2026-03-某科技/               ← 创建项目时自动生成（YYYY-MM-客户名）
│   │   └── reports/                  ← RA 生成的 Markdown 调研报告（可读导出版）
│   └── 2026-03-另一客户-a1b2c3d4/   ← 同月同客户时自动加短 ID 后缀
└── data/
    └── postgres/                     ← PostgreSQL Docker 数据目录（bind mount）
```

> **说明**：`reports/` 下的文件是**可读导出副本**，对话历史、评估结果、偏好记录等结构化数据的唯一存储仍在 PostgreSQL。

**Windows 用户**：将 `EAGLE_BASE_DIR` 设置为 `C:/Users/<你的用户名>/Desktop/Eagle`，并在 `docker-compose.yml` 中将 `${HOME}` 替换为 `${USERPROFILE}`。

## 数据库连接说明

### PostgreSQL + pgvector

使用 `pgvector/pgvector:pg16` Docker 镜像，**无需手动安装 pgvector 扩展**，初始迁移会自动执行：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**连接字符串格式：**

```
postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
```

**示例（本地 Docker）：**

```
DATABASE_URL=postgresql+asyncpg://eagle:eagle@localhost:5432/eagle
```

### 数据库结构

共 10 张表：

| 表名 | 说明 |
|------|------|
| `projects` | 猎头招聘项目 |
| `candidates` | 全局人才池 |
| `project_candidates` | 项目-候选人关联 + EA 评估结果 |
| `preference_logs` | 猎头偏好反馈记录 |
| `skill_ontology` | RA 产出的行业技能图谱 |
| `project_research` | 项目-调研结果关联 |
| `conversation_logs` | CA 对话历史 |
| `candidate_embeddings` | 候选人工作经历向量 |
| `industry_knowledge` | 行业知识向量块 |
| `requirement_embeddings` | 项目需求向量 |

向量表均建有 **HNSW 索引**，支持高效的近似最近邻搜索。

### Alembic 迁移命令

```bash
# 应用所有迁移
uv run alembic upgrade head

# 回滚一步
uv run alembic downgrade -1

# 查看当前迁移状态
uv run alembic current

# 生成新的迁移文件（修改模型后）
uv run alembic revision --autogenerate -m "description"
```

## API 认证

所有 API 端点（除 `/api/health`）需要在请求 header 中携带 API Key：

```
X-API-Key: your-secret-api-key-here
```

## 部署命令汇总

```bash
# 完整部署流程
cd /path/to/eagle

# 1. 启动数据库
docker compose up -d

# 2. 进入 backend 目录
cd backend

# 3. 安装依赖
uv sync

# 4. 配置环境变量
cp .env.example .env && vim .env

# 5. 执行迁移
uv run alembic upgrade head

# 6. 启动服务（开发）
uv run python main.py

# 6. 启动服务（生产）
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Agent 说明

| Agent | 文件 | 说明 |
|-------|------|------|
| **Coordinator Agent (CA)** | [app/agents/coordinator.py](app/agents/coordinator.py) | 对话层 + 编排层，使用 Claude tool use 循环 |
| **Research Agent (RA)** | [app/agents/research.py](app/agents/research.py) | 行业调研，使用 Claude 内置 web_search tool |
| **Evaluator Agent (EA)** | [app/agents/evaluator.py](app/agents/evaluator.py) | 候选人多维度评分 |

> **注意**：Agent 的系统提示词（system prompt）标记为 `TODO`，需要在实际与猎头使用中迭代调优。

## 日志

日志同时输出到：
- 控制台（彩色格式）
- `logs/eagle.log`（自动轮转，保留 7 天）

## 环境变量完整说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | — | PostgreSQL asyncpg 连接串 |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API Key |
| `ANTHROPIC_MODEL` | ❌ | `claude-sonnet-4-20250514` | 使用的 Claude 模型 |
| `ANTHROPIC_BASE_URL` | ❌ | `None`（官方） | 自定义 Anthropic 兼容 API 地址 |
| `OPENAI_API_KEY` | ✅ | — | OpenAI API Key（Embedding 用） |
| `OPENAI_EMBEDDING_MODEL` | ❌ | `text-embedding-3-small` | Embedding 模型 |
| `OPENAI_BASE_URL` | ❌ | `None`（官方） | 自定义 OpenAI 兼容 API 地址（Azure / 代理） |
| `EMBEDDING_DIMENSIONS` | ❌ | `1536` | 向量维度，需与模型匹配 |
| `API_KEY` | ✅ | — | 后端认证 Key（`X-API-Key` header） |
| `LOG_LEVEL` | ❌ | `INFO` | 日志级别 |
| `REPORTS_DIR` | ❌ | `reports` | RA 生成 Markdown 报告的存放目录 |
| `CORS_ORIGINS` | ❌ | `["*"]` | 允许的跨域来源列表 |

## TODO

- [ ] CA / EA / RA 系统提示词迭代调优
- [ ] CORS allowed origins 配置（Chrome 插件部署后更新为具体来源）
- [ ] Rate limiting（高并发场景）
