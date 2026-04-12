# Eagle Frontend

React + TypeScript + Vite frontend for the Eagle 猎头 AI Agent 桌面应用。它作为
本地 FastAPI 后端（localhost:52777）的 UI 壳，最终会被打包进 Tauri 桌面应用。

---

## 如何启动

```bash
pnpm install
pnpm dev          # dev server at http://localhost:5173
pnpm build        # prod bundle into dist/
```

Vite 已把 `/api` 代理到 `http://localhost:52777`，所以开发时只需单独启动后端。

---

## 项目结构

```
src/
├── components/
│   ├── layout/          # Sidebar, TopBar, AppShell
│   ├── chat/            # ChatView, bubbles, ProjectQuickCreate
│   ├── projects/        # ProjectsView, ProjectCard
│   ├── talent/          # TalentPoolView, CandidateDetailSheet
│   ├── research/        # ResearchView, TriggerResearchDialog
│   ├── settings/        # SettingsView (LLM / Auth / Embedding / System)
│   ├── shared/          # MatchDonut, StatusBadge, EmptyState, LoadingSpinner
│   └── ui/              # shadcn/ui primitives
├── lib/
│   ├── api-client.ts    # axios 实例 + X-API-Key 拦截器
│   └── api/             # 每个后端资源一个文件（projects/candidates/…）
├── stores/              # Zustand: app / project / candidate / chat / research
├── hooks/               # use-polling, use-debounce
├── types/               # 后端 Pydantic schema 对应的 TS 类型
└── main.tsx             # createBrowserRouter 入口
```

---

## 核心交互模型

### 1. Chat-first：项目由 CA 从自由文本中解析

猎头打开应用直接进入 `/`（Chat）。如果还没有绑定项目，Chat 面板渲染
**CA 介绍气泡**（`ProjectIntroBubble.tsx`）—— 纯文字，说明 CA 的能力，
并提示猎头直接在下方输入框里用一段话描述客户、职位、JD。**没有结构化表单。**

当 `currentProjectId` 为空时，ChatInput 的第一次 `onSend(message)`
走一条 **bootstrap 路径** (`ChatView.handleSend`)：

1. 用消息第一行（≤40 字）作为 `project_name`，`client_name` 设为 `"待 CA 解析"`，
   完整消息作为 `jd_raw`，调用 `POST /api/projects` 创建 stub 项目。
2. `selectProject(project)` 把新项目设为当前。
3. `await loadHistory(project.id)`（空数组）→ 清空 chat。
4. `sendMessage(project.id, message)` 正常走 `POST /projects/{id}/chat`，
   把用户原文转给 CA。

CA 收到用户原文后应该**用自己的 tool use 能力**解析客户名、职位名、
requirement_profile，然后通过 `PATCH /projects/{id}` 把 stub 项目的占位字段
填成真实值。前端不做任何文本解析。

> ⚠️ **后端要求**：Coordinator Agent 的 system prompt 需要知道当
> `project.client_name === "待 CA 解析"` 时自己要调一次
> `update_project` 工具把信息补齐（见 Backend Contract 一节）。

### 2. 一对话 = 一项目（1:1 绑定）

- 每条对话记录都挂在某个 `project_id` 下（后端表 `conversation_logs`）。
- 前端通过 `appStore.currentProjectId` 驱动：每次切换项目，`ChatView` 的
  `useEffect` 会重新 `loadHistory(projectId)`，渲染那个项目自己的聊天。
- 「新建项目」按钮（Sidebar 和 ProjectsView 里那个金色 CTA）的动作是：
  `clearProject() + clearMessages() + navigate('/')` —— 回到 Chat，显示空白表单，
  等于开一段新对话。

### 3. Settings 分区保存

Settings 页不用底部全局保存栏，而是**每张卡片自带保存按钮**（右下角），避免用户
忘记保存某一区。字段分为 4 组：

| 分组 | 字段 |
|---|---|
| LLM 配置 | `llmProvider`, `llmApiKey`, `llmModel`, `llmBaseUrl`, `webSearchContextSize` |
| 后端 Authentication | `authApiKey`（= 后端 `API_KEY` env，前端每次请求放进 `X-API-Key`） |
| Embedding 配置 | `embeddingApiKey`, `embeddingModel`, `embeddingDimensions`, `embeddingBaseUrl` |
| 系统 | `backendPort` |

每张卡片右上角有 `?` 图标，hover 弹出中文字段说明，并提示「LLM 和 Embedding
可以共用 provider / API key」。

所有配置都 persist 到 localStorage（key: `eagle-app-store`）。

---

## Backend Contract — 前端需要的后端接口

所有接口都走 `baseURL = /api`（dev 由 Vite 代理到 `localhost:8000`），请求头
统一带 `X-API-Key: <authApiKey>`。

### Health
| Method | Path | 用途 |
|---|---|---|
| GET | `/health` | Settings 页保存 auth key 时做连通性校验 |

### Projects
| Method | Path | 用途 |
|---|---|---|
| GET  | `/projects?skip=&limit=` | 项目列表（Projects 页、Sidebar 最近项目） |
| POST | `/projects` | Chat bootstrap 创建 stub 项目（client_name/project_name 初始为占位） |
| GET  | `/projects/{id}` | 选中项目时拉取详情 |
| PATCH| `/projects/{id}` | 修改 JD / 状态等；**CA 必须能调这个来回填 stub 项目的 client_name / project_name / requirement_profile** |

`ProjectCreate` body：
```ts
{ client_name: string; project_name: string; jd_raw?: string; mode?: 'precise'|'explore' }
```

### Conversations（项目级）
| Method | Path | 用途 |
|---|---|---|
| GET  | `/projects/{id}/conversations?skip=&limit=` | 加载该项目历史对话 |
| POST | `/projects/{id}/chat` | 向 CA 发送消息 |

`ChatRequest` → `ChatResponse`：
```ts
// request
{ message: string }
// response
{ reply: string; intent_json: Record<string, unknown> | null; conversation_id: string }
```

返回的 `reply` 前端用 `react-markdown` 渲染为 agent 气泡。

### Candidates / Talent Pool
| Method | Path | 用途 |
|---|---|---|
| GET  | `/candidates?skip=&limit=&location=&min_years=&max_years=&company=` | 人才表 + 筛选 |
| POST | `/candidates` | 由 Chrome 插件调用（非前端） |
| GET  | `/candidates/{id}` | Detail sheet |
| POST | `/candidates/search` | 语义搜索（`query: string`） |

### Evaluations（项目 × 候选人）
| Method | Path | 用途 |
|---|---|---|
| POST | `/projects/{id}/evaluations` | 触发匹配评估 |
| GET  | `/projects/{id}/evaluations/status` | 轮询评估状态（`use-polling` hook） |
| GET  | `/projects/{id}/candidates` | 项目-候选人关联 + 打分 |
| PATCH| `/projects/{id}/candidates/{cid}` | 改状态（已推荐 / 已淘汰 / 已面试） |

### Research
| Method | Path | 用途 |
|---|---|---|
| POST | `/projects/{id}/research` | TriggerResearchDialog 触发 RA |
| GET  | `/projects/{id}/research` | 报告列表 |

### Ontology（Research Agent 生成）
| Method | Path | 用途 |
|---|---|---|
| GET  | `/ontology` | 列表 |
| GET  | `/ontology/{id}` | 单个 ontology 文档 |

Ontology 结构（前端 `OntologyDoc` 渲染）：
```ts
{
  id: string
  industry: string
  concept: string
  synonyms: string[]
  tech_stack: string[]
  prerequisites: string[]
  key_positions: string[]
  skill_relations: Record<string, string[]>
  jargon: Record<string, string>
  created_at: string
}
```

### Preferences（猎头偏好学习，可选）
| Method | Path | 用途 |
|---|---|---|
| POST | `/preferences` | 记录 like/dislike |
| GET  | `/preferences?project_id=` | 列表 |

---

## 前端需要的后端数据约定

1. **所有 id 都是 UUID 字符串**，datetime 用 ISO-8601 字符串。
2. **后端 LLM/Embedding 配置目前来自 env**（`backend/.env`）。前端 Settings 的
   LLM / Embedding 字段只是**本地草稿** —— 如果要让用户在 UI 里改模型/base URL，
   后端需要新增 `PUT /settings` 接口来热更新运行时配置，或者前端把这些字段以
   header 形式下发，后端 agent 在构造 openai client 时读取覆盖。当前实现是
   「前端存了就算」，后端重启读最新 env。
3. **CORS**：开发时 Vite proxy 规避；Tauri 打包后前端从 `tauri://` 起源访问
   `localhost:8000`，后端需要 `allow_origins` 包含该源或 `*`。
4. **错误格式**：axios 拦截器不处理错误，各 store 自己 catch。后端异常用
   FastAPI 默认 `{ detail: string }` 即可。

---

## State 管理 (Zustand)

| Store | Persist | 关键状态 |
|---|---|---|
| `app-store` | ✅ localStorage | 所有 settings + `currentProjectId` + `currentProject` |
| `project-store` | ❌ | `projects[]`（每次 mount 重新 fetch） |
| `candidate-store` | ❌ | `candidates[]`, `searchResults[]`, `filters`, `pagination` |
| `chat-store` | ❌ | `messages[]`, `sending`（切项目自动清空 + reload） |
| `research-store` | ❌ | `records[]`, `selectedRecordId` |

`api-client.ts` 的拦截器在每次请求时读 `localStorage['eagle-app-store']`
（Zustand persist 的 key），避免 axios instance 与 store 之间的循环依赖。

---

## 设计系统

- **字体**：Manrope（headline）+ Inter（body），在 `src/index.css` 的 `@theme` 定义
- **主色**：`--color-primary: #745b00`（暗金），渐变用 `kinetic-gradient`
- **表面层级**：Material Design 3 naming
  （`surface-container-lowest` → `surface-container-highest`）
- **玻璃拟态**：`glass-overlay`（`bg-white/70 backdrop-blur-md`）
- **交互反馈**：点击 `scale-98-active`；页面过渡 `motion.div` fade+10px slide 200ms

---

## 验证

1. `pnpm dev` → `http://localhost:5173`
2. 前往 **设置**：填 `Authentication API Key` 保存 → 显示「✓ 已保存」表示
   `GET /health` 通过
3. 回到 **对话**：CA 介绍气泡显示。在输入框里随意描述一段招聘需求
   （例：「帮我给 XX 公司招一个高级 BMS 工程师，5 年以上经验…」）→
   前端自动创建 stub 项目 → CA 回复 → 检查 Projects 页看到 CA 回填后的
   `client_name` / `project_name`
4. **招聘项目** 页看到新项目卡片
5. 点击 Sidebar「新建项目」 → 回到空白对话 → 可再建一个新项目
6. 切换 `currentProject`（Sidebar 最近项目或 ProjectCard 的「选择项目」）→
   对话历史应自动切换
