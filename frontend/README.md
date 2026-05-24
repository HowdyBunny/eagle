# Eagle Frontend

React + TypeScript + Vite frontend for the Eagle 猎头 AI Agent 桌面应用。它作为
本地 FastAPI 后端（`127.0.0.1:52777`）的 UI 壳，最终会被打包进 Tauri 桌面应用。

---

## 如何启动

```bash
pnpm install
pnpm dev          # dev server at http://localhost:5173
pnpm build        # prod bundle into dist/
pnpm tauri dev    # 在 Tauri 窗口里调试
```

> **请求转发**：[api-client.ts](src/lib/api-client.ts) 把 baseURL 写死为
> `http://127.0.0.1:52777/api`，不依赖 Vite proxy。开发时只需要先把后端
> 跑起来就行。

---

## 项目结构

```
src/
├── pages/                       # createBrowserRouter 路由对应的页面
│   ├── ChatPage.tsx
│   ├── ProjectsPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── TalentPage.tsx
│   ├── TalentListsPage.tsx
│   ├── TalentListDetailPage.tsx
│   ├── ResearchPage.tsx
│   └── SettingsPage.tsx
├── components/
│   ├── layout/          # Sidebar, TopBar, AppShell
│   ├── chat/            # ChatView, bubbles, ProjectIntroBubble, ThreadSwitcher
│   ├── projects/        # ProjectsView, ProjectCard, ProjectDetailView,
│   │                    # EvaluationReportDrawer, CreateProjectDialog
│   ├── talent/          # TalentPoolView, CandidateDetailSheet, AddCandidateDialog
│   ├── talent-lists/    # TalentListsView, TalentListDetailView, SaveSearchDialog
│   ├── research/        # ResearchView, TriggerResearchDialog
│   ├── settings/        # SettingsView
│   ├── shared/          # MatchDonut, StatusBadge, EmptyState, LoadingSpinner
│   ├── ui/              # shadcn/ui primitives
│   └── ErrorBoundary.tsx
├── lib/
│   ├── api-client.ts    # axios 实例（baseURL = 127.0.0.1:52777/api）
│   ├── ws-bootstrap.ts  # WebSocket bootstrap 流（新建项目 + 首次 CA 解析）
│   └── api/             # 每个后端资源一个文件（projects/candidates/threads/talent-lists/…）
├── stores/              # Zustand: app / project / candidate / chat / research / talent-list / ui
├── hooks/               # use-polling, use-debounce
├── types/               # 后端 Pydantic schema 对应的 TS 类型
└── main.tsx             # 路由 + 全局错误捕获（→ POST /api/errors）
```

---

## 路由表

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | ChatPage | 主对话页（绑定 currentProjectId，可切换 thread） |
| `/projects` | ProjectsPage | 项目卡片列表 |
| `/projects/:id` | ProjectDetailPage | 项目详情 + 关联候选人评估 + 报告抽屉 |
| `/talent` | TalentPage | 全局人才池 + 混合搜索 + AddCandidateDialog |
| `/talent-lists` | TalentListsPage | 跨项目人才清单列表 |
| `/talent-lists/:id` | TalentListDetailPage | 清单成员 + outreach 状态 + 一键加入项目评估 |
| `/research` | ResearchPage | RA 报告 + 触发新调研 |
| `/settings` | SettingsPage | LLM / Embedding / Tavily 配置 + 后端端口 |

---

## 核心交互模型

### 1. WebSocket 项目 bootstrap

老的「先 `POST /projects` 起 stub，再 `POST /chat` 让 CA 回填」两步 REST
流程，已经换成单条 **WebSocket** 连接（[ws-bootstrap.ts](src/lib/ws-bootstrap.ts) →
后端 [api/ws_bootstrap.py](../backend/app/api/ws_bootstrap.py)）。

当 `currentProjectId` 为空、用户在 ChatInput 里发出第一条消息时：

1. 前端打开 `ws://127.0.0.1:52777/api/projects/bootstrap`，把首条消息原文丢过去
2. 后端边干边推事件：
   - `status` — 「正在创建项目…」「CA 正在思考…」之类的瞬时状态文案
   - `project_created` — stub 项目（`client_name="待 CA 解析"`）创建好了
   - `tool_call` — CA 调了某个工具（通常是 `update_project`）
   - `project_updated` — CA 把 stub 字段回填成真实客户名/职位名
   - `text` — LLM 流式 token
   - `ca_reply` — 最终回复 + `actions_taken` + `intent_json`
   - `done` — 流结束
3. 前端在收到 `project_created` 就 `selectProject`，收到 `done` 就 `loadHistory`

> **后端要求**：CA system prompt 里已经写死了规则——当
> `project.client_name === "待 CA 解析"` 时，CA 的第一个动作必须是
> `update_project`，把信息补齐。这条规则在 [coordinator.py](../backend/app/agents/coordinator.py)
> 的 system prompt 中以「最高优先级」存在，不要随意删。

### 2. 多线程对话（Threads）

一个项目下可以有多条对话 thread，每条 thread 独立保存上下文。

- API：`/api/projects/{id}/threads` 系列（CRUD）
- 组件：[ThreadSwitcher](src/components/chat/ThreadSwitcher.tsx) — chat 顶部切换器
- 历史接口：`/api/projects/{id}/conversations?thread_id=<uuid>` 按 thread 过滤；
  不传 `thread_id` 返回**所有**对话（含"初始对话"——thread 功能上线前的遗留消息，
  后端 `/threads` 列表里会追加一条 `is_legacy: true` 的合成 thread 表示它）

### 3. Chat-first：项目由 CA 从自由文本中解析

猎头打开应用直接进入 `/`（Chat）。如果还没有绑定项目，Chat 面板渲染
**CA 介绍气泡**（[ProjectIntroBubble.tsx](src/components/chat/ProjectIntroBubble.tsx)）——纯文字，
说明 CA 的能力，并提示猎头直接在下方输入框里用一段话描述客户、职位、JD。
**没有结构化表单**。第一条消息直接走 WS bootstrap 流（见上）。

### 4. 一对话 = 一项目（1:1 绑定）

- 每条对话记录都挂在某个 `project_id` 下（后端表 `conversation_logs`，可选 `thread_id` 外键）
- 前端通过 `appStore.currentProjectId` 驱动：每次切换项目，`ChatView` 的
  `useEffect` 会重新 `loadHistory(projectId)`，渲染那个项目自己的聊天
- 「新建项目」按钮（Sidebar 和 ProjectsView 里那个金色 CTA）的动作是：
  `clearProject() + clearMessages() + navigate('/')` — 回到 Chat，显示空白引导，
  等于开一段新对话

### 5. 人才清单（Talent Lists）

跨项目复用的候选人收藏夹，UI 入口在 sidebar「人才清单」。

- 数据流：[TalentListsView](src/components/talent-lists/TalentListsView.tsx) →
  `/api/talent-lists` →（后端）`talent_lists` + `talent_list_members` 两张表
- 用户行为：
  - 在 `/talent` 页面用搜索条件命中一批候选人 → [SaveSearchDialog](src/components/talent-lists/SaveSearchDialog.tsx)
    把当前 `filters_json` 快照存为清单
  - 在 `/talent-lists/:id` 里给每个成员标记 outreach 状态
    （`not_contacted` / `contacted` / `scheduled` / `declined` / `added_to_project`）
  - 「加入到项目评估」一键调用 `POST /projects/{id}/evaluate/{cid}?source_list_id=<list>`，
    后端会**原子地**把成员状态推进到 `added_to_project` 并触发 EA

### 6. Settings：运行时热更新

Settings 页不用底部全局保存栏，而是**每张卡片自带保存按钮**。字段分为 4 组：

| 分组 | 字段 |
|---|---|
| LLM 配置 | `vendorPreset`, `llmProvider`, `llmApiKey`, `llmModel`, `llmBaseUrl` |
| Tavily | `tavilyApiKey`（RA 网页搜索；缺失则 RA 不可用） |
| Embedding 配置 | `embeddingApiKey`, `embeddingModel`, `embeddingDimensions`, `embeddingBaseUrl` |
| 系统 | `backendPort` |

**重要**：保存时除了写入 localStorage（`eagle-app-store`），还会通过
`PUT /api/settings`（[lib/api/settings.ts](src/lib/api/settings.ts)）把
LLM/Embedding/Tavily 推给后端 — 后端的 `settings` 单例就地更新，下一次
agent 调用立即生效，并写回 `~/Desktop/Eagle/.env`。**不再需要重启后端**。

前端预置了 OpenAI / Anthropic / Qwen / GLM / Mimo 几个 vendor preset，
选中后自动填充 baseUrl + 默认 model，可手动覆盖。

每张卡片右上角有 `?` 图标，hover 弹出中文字段说明，并提示「LLM 和 Embedding
可以共用 provider / API key」。

---

## Backend Contract — 前端用到的后端接口

所有接口都走 `baseURL = http://127.0.0.1:52777/api`。**当前没有认证头**
（早期版本的 `X-API-Key` 已移除，后端不再校验任何 header）。

完整 OpenAPI 见 http://localhost:52777/docs，下面只列与前端 UI 行为耦合最紧的端点。

### Health & Settings
| Method | Path | 用途 |
|---|---|---|
| GET  | `/health` | Settings 页保存时做连通性校验 |
| GET  | `/settings` | 拉取当前运行时配置（密钥已脱敏） |
| PUT  | `/settings` | 热更新 LLM/Embedding/Tavily，写回 `~/Desktop/Eagle/.env` |
| POST | `/errors` | 前端 JS 异常上报（`window.onerror` + `unhandledrejection`） |

### Projects
| Method | Path | 用途 |
|---|---|---|
| GET    | `/projects?skip=&limit=` | 项目列表（Projects 页、Sidebar 最近项目） |
| POST   | `/projects` | （目前仅 WS bootstrap 用；可保留作为兜底） |
| GET    | `/projects/{id}` | 选中项目时拉取详情 |
| PATCH  | `/projects/{id}` | CA 工具 `update_project` 回填 stub 项目；前端 UI 也用来改 JD/状态 |
| DELETE | `/projects/{id}` | 删除项目（级联删除关联表） |
| **WS** | `/projects/bootstrap` | 单条连接完成「建 stub + CA 首次回填」（见上文） |

### Conversations & Threads（项目级）
| Method | Path | 用途 |
|---|---|---|
| GET    | `/projects/{id}/conversations?thread_id=&skip=&limit=` | 加载历史，可按 thread 过滤 |
| POST   | `/projects/{id}/chat` | 同步对话（一次 request → 一次完整回复） |
| POST   | `/projects/{id}/chat/stream` | **SSE 流式**对话（推荐默认通路） |
| GET    | `/projects/{id}/threads` | thread 列表（含合成的 legacy thread） |
| POST   | `/projects/{id}/threads` | 新建 thread |
| PATCH  | `/projects/{id}/threads/{tid}` | 重命名 thread |
| DELETE | `/projects/{id}/threads/{tid}` | 删除 thread |

`POST /chat/stream` SSE 事件格式：
```ts
// event 数据是 `data: <json>\n\n`
{ type: "tool_call", name: string, label: string }
{ type: "text",      delta: string }
{ type: "done",      reply_text: string, actions_taken: string[], intent_json, conversation_id }
{ type: "error",     message: string }
```

### Candidates / Talent Pool
| Method | Path | 用途 |
|---|---|---|
| GET    | `/candidates?skip=&limit=&location=&min_years=&max_years=&company=` | 人才表 + 简易筛选 |
| POST   | `/candidates` | 由 Chrome 插件或 TA 调用 |
| GET    | `/candidates/{id}` | Detail sheet |
| PATCH  | `/candidates/{id}` | 编辑信息（索引字段变更自动触发重新向量化） |
| DELETE | `/candidates/{id}` | 删除（级联清理向量库） |
| POST   | `/candidates/search` | **混合检索**（SQL + FTS + 向量 + RRF），见后端 `search_service.py` |
| POST   | `/candidates/rewrite-query` | 把自由文本切成结构化过滤 + 语义残余；返回 `used_llm` 让 UI 显示「智能搜索」标识 |
| GET    | `/candidates/{id}/evaluations` | 该候选人在所有项目里的历史评估 |

### Talent Lists（跨项目）
| Method | Path | 用途 |
|---|---|---|
| GET    | `/talent-lists?project_id=&unassigned=` | 清单列表（可按项目过滤；`unassigned=true` 拉孤儿清单） |
| POST   | `/talent-lists` | 新建（带 `filters_json` 可作为搜索快照） |
| GET / PATCH / DELETE | `/talent-lists/{id}` | 单条 CRUD |
| POST   | `/talent-lists/{id}/members` | 批量加成员（candidate_ids 数组） |
| PATCH  | `/talent-lists/{id}/members/{cid}` | 改 outreach 状态 / hunter_note |
| DELETE | `/talent-lists/{id}/members/{cid}` | 移除成员 |

### Evaluations（项目 × 候选人）
| Method | Path | 用途 |
|---|---|---|
| POST  | `/projects/{id}/evaluate/{cid}?source_list_id=<uuid>` | 触发匹配评估（detached task）。带 `source_list_id` 会原子地把清单成员状态推进到 `added_to_project` |
| GET   | `/projects/{id}/candidates/{cid}/status` | 轮询评估状态（`is_complete` / `match_score` / `evaluated_at`） |
| GET   | `/projects/{id}/candidates` | 项目-候选人关联 + 打分 |
| POST  | `/projects/{id}/candidates/{cid}/link` | 手动建立项目-候选人关联（不触发评估） |
| PATCH | `/projects/{id}/candidates/{cid}` | 改状态（recommended / eliminated / interviewed）+ hunter_feedback |

### Research
| Method | Path | 用途 |
|---|---|---|
| POST | `/projects/{id}/research` | 触发 RA |
| GET  | `/projects/{id}/research` | 报告列表 |
| GET  | `/projects/{id}/research/{rid}/report` | 读取 markdown 报告正文 |

### Ontology
| Method | Path | 用途 |
|---|---|---|
| GET  | `/ontology` | 列表 |
| GET  | `/ontology/{id}` | 详情 |

### Preferences
| Method | Path | 用途 |
|---|---|---|
| POST | `/projects/{id}/preferences` | 记录 like/dislike，可带 `weight_adjustment` |
| GET  | `/projects/{id}/preferences` | 列表 |

---

## 前端需要的后端数据约定

1. **所有 id 都是 UUID 字符串**，datetime 用 ISO-8601 字符串
2. **没有认证头**。后端只靠 `localhost` 监听 + `CORS_ORIGINS` 做隔离；前端
   axios 实例不挂任何 `Authorization` / `X-API-Key`
3. **CORS**：开发时 axios 直连 `127.0.0.1:52777`（不走 Vite proxy）；
   Tauri 打包后前端从 `tauri://` 起源访问 `127.0.0.1:52777`，
   后端 `allow_origins=["*"]` 兜底
4. **错误格式**：axios 拦截器不处理错误，各 store 自己 catch。后端异常用
   FastAPI 默认 `{ detail: string }`
5. **运行时配置**：LLM/Embedding/Tavily 现在通过 `PUT /api/settings` 由前端推到后端，
   后端就地更新 + 持久化到 `~/Desktop/Eagle/.env`，**不再依赖 `.env` 重启**

---

## State 管理 (Zustand)

| Store | Persist | 关键状态 |
|---|---|---|
| `app-store` | ✅ localStorage | 所有 settings（含 vendor preset + Tavily）+ `currentProjectId` + `currentProject` |
| `project-store` | ❌ | `projects[]`（每次 mount 重新 fetch） |
| `candidate-store` | ❌ | `candidates[]`, `searchResults[]`, `filters`, `pagination` |
| `chat-store` | ❌ | `messages[]`, `currentThreadId`, `sending`（切项目/切 thread 自动清空 + reload） |
| `talent-list-store` | ❌ | `lists[]`, `currentListId`, `members[]` |
| `research-store` | ❌ | `records[]`, `selectedRecordId` |
| `ui-store` | ❌ | sidebar 折叠、drawer 打开/关闭等纯 UI 状态 |

> ⚠️ **已知 TODO**（见根目录 [TODO.md](../TODO.md)）：WS bootstrap 期间的
> `bootstrapping` / `bootstrapStatus` 仍然在 `ChatView` 的本地 React state 里，
> 切走再回来会丢；正在重构到 chat-store。

---

## 设计系统

- **字体**：Manrope（headline）+ Inter（body），在 [src/index.css](src/index.css) 的 `@theme` 定义
- **主色**：`--color-primary: #745b00`（暗金），渐变用 `kinetic-gradient`
- **表面层级**：Material Design 3 naming
  （`surface-container-lowest` → `surface-container-highest`）
- **玻璃拟态**：`glass-overlay`（`bg-white/70 backdrop-blur-md`）
- **交互反馈**：点击 `scale-98-active`；页面过渡 `motion.div` fade+10px slide 200ms

---

## 全局错误捕获

[main.tsx](src/main.tsx) 在 window 上挂了 `error` + `unhandledrejection` 监听，
统一通过 `POST /api/errors` 上报到后端 `logs/eagle.log`。
React 渲染期错误由 [ErrorBoundary](src/components/ErrorBoundary.tsx) 兜住。

另外 `dragover` / `drop` 在 window 上被全局阻止默认行为，避免用户把文件拖到
**非投递区**时浏览器把整个 webview 替换成 PDF/Image viewer。

---

## 验证清单

1. `pnpm dev` → `http://localhost:5173`
2. **设置页**：选 vendor preset → 填 LLM/Embedding/Tavily key → 各分区分别保存
   → 显示「✓ 已保存」表示 `PUT /api/settings` 通过
3. **对话页**：CA 介绍气泡显示。输入框写一段招聘需求 → WS bootstrap 启动
   → 看到「正在创建项目…→ 正在分析需求…→ CA 流式回复」 → 检查 Projects 页有 CA
   回填后的项目卡
4. **多 thread**：在 chat 顶部的 ThreadSwitcher 新建 thread，切回旧 thread 应保留各自的历史
5. **项目详情**：点项目卡 → 看到关联候选人 + 评分 → 抽屉打开评估报告
6. **人才池 → 清单**：搜索一批 → SaveSearchDialog 保存为清单 → 在
   `/talent-lists/:id` 标记 outreach 状态 → 一键加入项目评估
7. **行业研究**：触发 RA → 等待 Tavily 抓取 → 报告出现在 Research 页
