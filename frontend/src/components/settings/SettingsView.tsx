import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, Key, Sparkles, Database, Server, HelpCircle, Save, RotateCcw, FolderOpen } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore, type SettingsState } from '@/stores/app-store'
import { checkHealth } from '@/lib/api/health'
import { updateRuntimeSettings } from '@/lib/api/settings'

// ────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────────────────────────────────

const inputClass =
  'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

const monoInputClass = `${inputClass} font-mono`

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-secondary mt-1.5">{hint}</p>}
    </div>
  )
}

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${monoInputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function SettingsCard({
  icon,
  title,
  subtitle,
  tooltip,
  saving,
  status,
  onSave,
  onReset,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  tooltip?: ReactNode
  saving: boolean
  status: 'idle' | 'ok' | 'error'
  onSave: () => void
  onReset?: () => void
  children: ReactNode
}) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h2 className="font-headline font-bold text-sm text-on-surface">{title}</h2>
            <p className="text-[10px] text-secondary uppercase tracking-widest font-bold">{subtitle}</p>
          </div>
        </div>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button className="text-secondary/70 hover:text-primary transition-colors">
                  <HelpCircle size={16} />
                </button>
              }
            />
            <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="px-6 py-5 space-y-4">{children}</div>

      <div className="px-6 py-3 border-t border-outline-variant/10 flex items-center justify-end gap-3">
        {status === 'ok' && <span className="text-[11px] text-green-600 font-medium">✓ 已保存</span>}
        {status === 'error' && <span className="text-[11px] text-red-600 font-medium">✗ 保存失败</span>}
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <RotateCcw size={12} /> 重置
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg kinetic-gradient text-white text-[11px] font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50"
        >
          <Save size={12} /> {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

export default function SettingsView() {
  const settings = useAppStore()
  const { updateSettings, setBackendPort } = settings

  // Local draft state per section, so save buttons commit atomically.
  const [llm, setLlm] = useState({
    llmProvider: settings.llmProvider,
    llmApiKey: settings.llmApiKey,
    llmModel: settings.llmModel,
    llmBaseUrl: settings.llmBaseUrl,
    webSearchContextSize: settings.webSearchContextSize,
  })
  const [auth, setAuth] = useState({ authApiKey: settings.authApiKey })
  const [emb, setEmb] = useState({
    embeddingApiKey: settings.embeddingApiKey,
    embeddingModel: settings.embeddingModel,
    embeddingDimensions: settings.embeddingDimensions,
    embeddingBaseUrl: settings.embeddingBaseUrl,
  })
  const [sys, setSys] = useState({ backendPort: String(settings.backendPort) })

  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, 'idle' | 'ok' | 'error'>>({
    llm: 'idle', auth: 'idle', emb: 'idle', sys: 'idle',
  })

  const flashStatus = (key: string, s: 'ok' | 'error') => {
    setStatus((p) => ({ ...p, [key]: s }))
    setTimeout(() => setStatus((p) => ({ ...p, [key]: 'idle' })), 2500)
  }

  const saveSection = async (key: string, patch: Partial<SettingsState>, validate?: () => Promise<void>) => {
    setSaving(key)
    updateSettings(patch)
    try {
      if (validate) await validate()
      flashStatus(key, 'ok')
    } catch {
      flashStatus(key, 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <TooltipProvider delay={150}>
      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Backend Auth */}
          <SettingsCard
            icon={<Key size={16} className="text-primary" />}
            title="后端 Authentication"
            subtitle="前端与本地 FastAPI 通信密钥"
            tooltip={
              <div className="space-y-1.5">
                <p><strong>Authentication API Key</strong>：前端每次请求在 <code>X-API-Key</code> header 里携带，后端 <code>API_KEY</code> 环境变量必须与之一致。</p>
                <p className="text-secondary">这只是本地认证，不上传任何第三方。</p>
              </div>
            }
            saving={saving === 'auth'}
            status={status.auth}
            onSave={() =>
              saveSection('auth', auth, async () => {
                await checkHealth()
              })
            }
          >
            <Field label="Authentication API Key" hint="点击保存会尝试 GET /health 验证连通性">
              <SecretInput value={auth.authApiKey} onChange={(v) => setAuth({ authApiKey: v })} placeholder="your-secret-api-key-here" />
            </Field>
          </SettingsCard>

          {/* LLM Section */}
          <SettingsCard
            icon={<Sparkles size={16} className="text-primary" />}
            title="LLM 配置"
            subtitle="Coordinator / Research / Evaluator Agent 共用"
            tooltip={
              <div className="space-y-1.5">
                <p><strong>LLM Provider</strong>：SDK 类型。openai 走 chat.completions + responses API；anthropic 走 messages API。</p>
                <p><strong>LLM API Key</strong>：模型调用密钥。</p>
                <p><strong>LLM Model</strong>：模型名称，例如 gpt-4o、claude-sonnet-4-5。</p>
                <p><strong>LLM Base URL</strong>：第三方代理地址。openai 必须以 /v1 结尾；anthropic 不要带 /v1。留空使用官方默认。</p>
                <p><strong>Web Search Context Size</strong>：RA 网页搜索上下文大小（仅 openai Responses API 支持）。</p>
                <p className="text-primary pt-1">💡 LLM 和 Embedding 可以使用同一个 Provider 和 API Key。</p>
              </div>
            }
            saving={saving === 'llm'}
            status={status.llm}
            onSave={() => saveSection('llm', llm, async () => {
              await updateRuntimeSettings({
                llm_provider: llm.llmProvider,
                llm_api_key: llm.llmApiKey,
                llm_model: llm.llmModel,
                llm_base_url: llm.llmBaseUrl || undefined,
                web_search_context_size: llm.webSearchContextSize,
              })
            })}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="LLM Provider">
                <select
                  value={llm.llmProvider}
                  onChange={(e) => setLlm({ ...llm, llmProvider: e.target.value as 'openai' | 'anthropic' })}
                  className={inputClass}
                >
                  <option value="openai">OpenAI (chat.completions + responses)</option>
                  <option value="anthropic">Anthropic (messages)</option>
                </select>
              </Field>
              <Field label="LLM Model" hint="例如：gpt-4o、claude-sonnet-4-5">
                <input value={llm.llmModel} onChange={(e) => setLlm({ ...llm, llmModel: e.target.value })} placeholder="gpt-4o" className={monoInputClass} />
              </Field>
            </div>
            <Field label="LLM API Key">
              <SecretInput value={llm.llmApiKey} onChange={(v) => setLlm({ ...llm, llmApiKey: v })} placeholder="sk-..." />
            </Field>
            <Field label="LLM Base URL" hint="留空走官方端点。openai 带 /v1，anthropic 不带。">
              <input value={llm.llmBaseUrl} onChange={(e) => setLlm({ ...llm, llmBaseUrl: e.target.value })} placeholder="https://your-provider.example.com/v1" className={monoInputClass} />
            </Field>
            <Field label="Web Search Context Size">
              <select
                value={llm.webSearchContextSize}
                onChange={(e) => setLlm({ ...llm, webSearchContextSize: e.target.value as 'low' | 'medium' | 'high' })}
                className={inputClass}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </Field>
          </SettingsCard>

          {/* Embedding */}
          <SettingsCard
            icon={<Database size={16} className="text-primary" />}
            title="Embedding 配置"
            subtitle="候选人 & JD 向量生成"
            tooltip={
              <div className="space-y-1.5">
                <p><strong>Embedding API Key</strong>：embedding 调用密钥。</p>
                <p><strong>Embedding Model</strong>：例如 text-embedding-3-small。</p>
                <p><strong>Embedding Dimensions</strong>：向量维度，与模型匹配（3-small 为 1536）。</p>
                <p><strong>Embedding Base URL</strong>：OpenAI 兼容 embedding 端点，需带 /v1。留空走官方。</p>
                <p className="text-primary pt-1">💡 可直接复用 LLM 的 Provider / API Key / Base URL。</p>
              </div>
            }
            saving={saving === 'emb'}
            status={status.emb}
            onSave={() => saveSection('emb', emb, async () => {
              await updateRuntimeSettings({
                embedding_api_key: emb.embeddingApiKey,
                embedding_model: emb.embeddingModel,
                embedding_base_url: emb.embeddingBaseUrl || undefined,
                embedding_dimensions: emb.embeddingDimensions,
              })
            })}
          >
            <Field label="Embedding API Key">
              <SecretInput value={emb.embeddingApiKey} onChange={(v) => setEmb({ ...emb, embeddingApiKey: v })} placeholder="sk-..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Embedding Model">
                <input value={emb.embeddingModel} onChange={(e) => setEmb({ ...emb, embeddingModel: e.target.value })} placeholder="text-embedding-3-small" className={monoInputClass} />
              </Field>
              <Field label="Embedding Dimensions" hint="必须与模型输出维度一致，修改后需重建向量库">
                <input
                  type="number"
                  value={emb.embeddingDimensions}
                  onChange={(e) => setEmb({ ...emb, embeddingDimensions: Number(e.target.value) || 0 })}
                  placeholder="1536"
                  className={monoInputClass}
                />
              </Field>
            </div>
            <Field label="Embedding Base URL" hint="必须以 /v1 结尾。留空走 OpenAI 官方。">
              <input value={emb.embeddingBaseUrl} onChange={(e) => setEmb({ ...emb, embeddingBaseUrl: e.target.value })} placeholder="https://your-provider.example.com/v1" className={monoInputClass} />
            </Field>
          </SettingsCard>

          {/* System */}
          <SettingsCard
            icon={<Server size={16} className="text-primary" />}
            title="系统配置"
            subtitle="后端服务器设置"
            saving={saving === 'sys'}
            status={status.sys}
            onSave={() => {
              setBackendPort(Number(sys.backendPort) || 8000)
              flashStatus('sys', 'ok')
            }}
          >
            <Field label="后端端口" hint="默认 8000，修改后需重启后端服务">
              <input
                type="number"
                value={sys.backendPort}
                onChange={(e) => setSys({ backendPort: e.target.value })}
                className={`${monoInputClass} w-48`}
              />
            </Field>
          </SettingsCard>

          {/* Data folders (read-only) */}
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="font-headline font-bold text-sm text-on-surface">数据文件夹</h2>
                <p className="text-[10px] text-secondary uppercase tracking-widest font-bold">本地存储路径</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <Field label="数据库存储路径" hint="SQLite + ChromaDB 存储位置">
                <div className="bg-surface-container-low rounded-lg px-4 py-3 font-mono text-sm text-secondary">
                  ~/Desktop/Eagle/data/
                </div>
              </Field>
              <Field label="行业报告存储路径" hint="Research Agent 生成的 Markdown">
                <div className="bg-surface-container-low rounded-lg px-4 py-3 font-mono text-sm text-secondary">
                  ~/Desktop/Eagle/reports/
                </div>
              </Field>
              <p className="text-[11px] text-secondary/70 italic">文件夹选择将在 Tauri 桌面版本开放</p>
            </div>
          </section>

        </div>
      </div>
    </TooltipProvider>
  )
}
