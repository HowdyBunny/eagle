技术文档 v1：
此Agent应用使用Python语言进行后端Agent流的编写

Chrome插件：TypeScript，Service Worker，使用WXT来进行构建，UI使用React + Tailwind CSS。依赖只需要wxt、react、react-dom、tailwindcss、typescript

后端：
使用FastAPI。
LLM的调用直接使用openai的规范库，并且使用tool use和function calling的方式去网页搜索、注册Agentic项目现有的Agent或者工具
核心依赖：fastapi、uvicorn、sqlalchemy[asyncio]、asyncpg、
alembic、pgvector、pydantic、openai、
sentence-transformers（如果本地embedding）、
httpx、pydantic-settings（管理环境api key）、tqdm、loguru

（旧版，新版去除）数据库ORM：SQLAlchemy 2.0 + asyncpg
（旧版，新版去除）向量数据库：pgvector

Embedding模型：openai 的 text-embedding-3-small（调动API）

任务队列：FastAPI的BackgroundTasks
项目结构管理：使用uv进行init和add依赖


# 猎头 Agent 助手 — 技术文档 v2

## 项目概述

为猎头提供 AI Agent 驱动的本地桌面应用，核心功能包括：招聘需求分析、人才库匹配评分、行业信息洞察、文档生成。

目标：macOS 本地运行，猎头无需接触命令行，一键安装使用。

---

## 架构总览

```
┌─ macOS 桌面应用 (.dmg) ─────────────────────────────┐
│                                                       │
│  Tauri 壳（系统托盘、窗口管理）                   │
│                                                       │
│  ┌─ 前端 (React) ──────────────────────────────────┐  │
│  │  招聘项目管理 │ 人才管理 │ 行业报告 │ 对话交互   │  │
│  └──────────────────────┬──────────────────────────┘  │
│                         │ HTTP → localhost:52777（可在后续修改端口，避免占用）  │
│  ┌──────────────────────▼──────────────────────────┐  │
│  │  FastAPI 后端（PyInstaller 打包为 sidecar）      │  │
│  │                                                  │  │
│  │  Coordinator Agent                    │  │
│  │  Research Agent                       │  │
│  │  Evaluator Agent                   │  │
│  │                                                  │  │
│  │  SQLite ← 结构化数据       │  │
│  │  ChromaDB ← 向量数据         │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
         ↑
   Chrome 插件 → POST localhost:52777/api/candidates
   （单一职责：抓取候选人页面信息并入库）
```

---

## 一、Chrome 插件（信息采集层）

**职责：** 在 LinkedIn 等招聘网站上抓取候选人信息，POST 到本地后端，仅此一个功能。

| 项目       | 选型                              |
| ---------- | --------------------------------- |
| 语言       | TypeScript                        |
| 构建工具   | WXT                               |
| 运行方式   | Service Worker (Manifest V3)      |
| UI         | React + Tailwind CSS（弹出面板）  |
| 核心依赖   | wxt, react, react-dom, tailwindcss, typescript |

---

## 二、桌面前端（交互层）

**职责：** 猎头与 Agent 系统的所有交互入口。

| 项目       | 选型                              |
| ---------- | --------------------------------- |
| 框架       | React + TypeScript             |
| 样式       | Tailwind CSS                      |
| UI 组件库  | shadcn/ui                         |
| 路由       | React Router                      |
| 状态管理   | Zustand（轻量）   |
| HTTP 请求  | fetch / axios → localhost    |
| Markdown渲染 | react-markdown（Agent 回复渲染）|
| 构建工具   | Vite                              |

**核心页面：**

| 页面           | 功能说明                                      |
| -------------- | --------------------------------------------- |
| 招聘项目管理   | 查看现在的创建的项目有什么，点击后进行选定项目 |
| 人才库       | 查看现有的人才库，显示人才的相关信息   |
| 行业研究       | 查看Research Agent 返回行业分析报告              |
| 主页面         | 和CA进行对话， Agent 交互             |
| 设置           | 各个API Key 管理、数据导入导出文件夹设置，启动端口调整                     |

---

## 三、后端（Agent 服务层）

**职责：** 接收前端和插件请求，调度 Agent，管理数据。

| 项目           | 选型                              |
| -------------- | --------------------------------- |
| 框架           | FastAPI                           |
| ASGI 服务器    | uvicorn                           |
| 项目管理       | uv                                |
| 打包           | PyInstaller（--onedir 模式）       |

**核心依赖：**

| 依赖              | 用途                     | 备注                    |
| ----------------- | ------------------------ | ----------------------- |
| fastapi           | Web 框架                 | 保持不变                |
| uvicorn           | ASGI 服务器              | 保持不变                |
| pydantic          | 数据校验                 | 保持不变                |
| pydantic-settings | 环境变量 & API Key 管理  | 保持不变                |
| openai            | LLM 调用 + Embedding     | 保持不变                |
| httpx             | 异步 HTTP 客户端         | 保持不变                |
| loguru            | 日志                     | 保持不变                |
| tqdm              | 进度显示                 | 保持不变                |
| **chromadb**      | **向量数据库（嵌入式）** |        |
| **aiosqlite**     | **SQLite 异步驱动**      |         |
| sqlalchemy[asyncio] | ORM                    | **驱动改为 aiosqlite**  |
| alembic           | 数据库迁移               | **适配 SQLite**         |


**Embedding：** OpenAI text-embedding-3-small（API 调用，无本地计算）

**任务队列：** FastAPI BackgroundTasks

---

## 四、数据库（存储层）

### 结构化数据：SQLite

| 项目       | 说明                                    |
| ---------- | --------------------------------------- |
| 驱动       | aiosqlite（异步）                       |
| ORM        | SQLAlchemy 2.0 async                    |
| 迁移       | Alembic                                 |
| 存储位置   | Mac或者Windows桌面的Eagle文件夹中的data文件夹内 |

**存储内容：** 候选人信息、招聘需求、公司信息、匹配记录、对话历史

### 向量数据：ChromaDB

| 项目       | 说明                                    |
| ---------- | --------------------------------------- |
| 模式       | 嵌入式（PersistentClient）              |
| 存储位置   | Mac或者Windows桌面的Eagle文件夹中的data文件夹内 |

**存储内容：** 候选人 embedding、职位需求 embedding

---

## 五、桌面打包（分发层）

| 项目           | 选型                              |
| -------------- | --------------------------------- |
| 桌面框架       | Tauri 2.0                         |
| 后端打包       | PyInstaller (--onedir)            |
| 后端启动方式   | Tauri Sidecar                     |
| 安装包格式     | .dmg (macOS)                      |
| 数据目录       | ~/Library/Application Support/AppName/ |

**Tauri Sidecar 工作流：**
1. 用户启动
2. Tauri 自动启动 PyInstaller 打包的 FastAPI 后端
3. 后端监听 localhost:52777（可以在设置中调整，并重新加载）
4. 前端 WebView 加载 React 应用
5. 退出应用时自动关闭后端进程

**首次启动引导：**
1. 欢迎页面
2. 输入 OpenAI API Key（存入本地配置文件，加密存储）
3. 完成，进入主界面

---

## 六、开发阶段规划

### 阶段 0：数据库迁移 ✅ 已完成
- [x] SQLAlchemy 驱动从 asyncpg 切换为 aiosqlite
- [x] 数据模型适配 SQLite 语法差异（UUID→String(36), JSONB→JSON, Enum 去除 PG 参数, onupdate 事件监听）
- [x] pgvector 相关代码迁移到 ChromaDB（新建 chroma_service.py，重写 embedding_service.py、search_service.py、evaluator.py）
- [x] Alembic 迁移脚本适配（render_as_batch=True，重写为 SQLite 版 001 migration）
- [x] 编写数据迁移脚本（PostgreSQL → SQLite）（暂不需要，无生产数据）
- [x] 验证三个 Agent 在新数据库上功能正常（代码层面适配完成，待运行时验证）

### 阶段 1：前端开发（使用pnpm来进行构建）✅ 已完成
- [x] Vite + React + TypeScript 项目初始化
- [x] shadcn/ui + Tailwind CSS v4 配置，金色主题 token
- [x] 对接现有 FastAPI API，实现核心页面（Chat / Projects / Talent Pool / Research / Settings）
- [x] 浏览器直接访问测试（pnpm build 通过）

### 阶段 2：Chrome 插件优化
- [ ] 确认插件 → 后端 → 入库流程顺畅
- [ ] 添加抓取成功/失败的反馈提示
- [ ] 桌面端收到新候选人时显示通知

### 阶段 3：桌面打包
- [ ] PyInstaller 打包 FastAPI 后端
- [ ] Tauri 项目初始化 + Sidecar 配置
- [ ] 前端集成到 Tauri WebView
- [ ] .dmg 安装包生成
- [ ] 首次启动引导流程

### 阶段 4：体验打磨
- [ ] 系统托盘图标
- [ ] 自动更新机制
- [ ] 错误处理 & 用户友好提示
- [ ] 数据导入导出功能

---

## 八、关键技术决策记录

| 决策               | 选择            | 理由                                         |
| ------------------ | --------------- | -------------------------------------------- |
| 后端语言           | Python (FastAPI) | Agent 逻辑已实现；AI 生态丰富       |
| 数据库             | SQLite + ChromaDB | 嵌入式，零安装，适合本地桌面应用              |
| 桌面框架           | Tauri            | 轻量（~20MB），原生 macOS 体验，Sidecar 支持  |
| 前端               | React + shadcn/ui | 组件丰富，社区大，开发效率高                  |
| 为什么不换 Node.js | —               | 已有 Python Agent 代码，重写成本高于打包成本   |
| 为什么不用 Electron| —               | 体积大（150MB+），内存占用高                   |
| 为什么不上云       | —               | 猎头数据敏感，本地运行更安全，用户更信任       |