import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, Sparkles, Database, Server, HelpCircle, Save, RotateCcw, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore, type SettingsState, type VendorPresetId, type LLMProvider, type WebSearchStrategy } from '@/stores/app-store'
import { updateRuntimeSettings } from '@/lib/api/settings'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// Vendor preset definitions
// ────────────────────────────────────────────────────────────────────────────

interface VendorPreset {
  id: VendorPresetId
  label: string
  region: string          // displayed as small tag
  provider: LLMProvider
  baseUrl: string
  defaultModel: string
  webSearchStrategy: WebSearchStrategy
  webSearchExtraBody: string
  webSearchOk: boolean
  webSearchNote: string
  isCustom?: boolean
}

const VENDOR_PRESETS: VendorPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    region: '官方',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.2',
    webSearchStrategy: 'openai_responses',
    webSearchExtraBody: '',
    webSearchOk: true,
    webSearchNote: 'Responses API',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    region: '官方',
    provider: 'anthropic',
    baseUrl: '',
    defaultModel: 'claude-sonnet-4-6',
    webSearchStrategy: 'anthropic_builtin',
    webSearchExtraBody: '',
    webSearchOk: true,
    webSearchNote: '内置搜索工具',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    region: '阿里',
    provider: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen3.6-plus',
    webSearchStrategy: 'extra_body',
    webSearchExtraBody: '{"enable_search": true}',
    webSearchOk: true,
    webSearchNote: 'enable_search',
  },
  {
    id: 'glm',
    label: 'GLM',
    region: '智谱',
    provider: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    defaultModel: 'glm-5.1',
    webSearchStrategy: 'none',
    webSearchExtraBody: '',
    webSearchOk: false,
    webSearchNote: '联网待确认',
  },
  {
    id: 'mimo',
    label: 'Mimo',
    region: '小米',
    provider: 'openai',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    defaultModel: 'mimo-v2-pro',
    webSearchStrategy: 'openai_tool',
    webSearchExtraBody: '',
    webSearchOk: true,
    webSearchNote: 'web_search tool',
  },
  {
    id: 'custom',
    label: '第三方',
    region: '自定义',
    provider: 'openai',
    baseUrl: '',
    defaultModel: '',
    webSearchStrategy: 'none',
    webSearchExtraBody: '',
    webSearchOk: false,
    webSearchNote: '无内置联网',
    isCustom: true,
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────────────────────────────────

const inputClass =
  'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

const monoInputClass = `${inputClass} font-mono`

// SelectTrigger needs a separate class — it has its own internal styles that
// conflict with inputClass (e.g. border, bg, padding, width).  We only override
// what's needed so tailwind-merge can resolve conflicts cleanly.
const selectTriggerClass =
  'w-full h-auto bg-surface-container-low border-0 border-b-2 border-transparent rounded-lg px-4 py-3 text-sm text-on-surface outline-none transition-colors'

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
        autoComplete="new-password"
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
// Vendor preset card
// ────────────────────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: VendorPreset
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all text-center w-full',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-outline-variant/20 hover:border-outline-variant/50 hover:bg-surface-container-low/50',
      )}
    >
      <span className={cn('text-[13px] font-headline font-bold', selected ? 'text-primary' : 'text-on-surface')}>
        {preset.label}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-secondary font-bold">{preset.region}</span>
      {preset.webSearchOk ? (
        <span className="text-[9px] text-green-600 font-medium">联网 ✓</span>
      ) : (
        <span className="text-[9px] text-secondary">联网 —</span>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

export default function SettingsView() {
  const store = useAppStore()
  const { updateSettings, setBackendPort } = store

  // ── LLM draft state ──────────────────────────────────────────────────────
  const [llm, setLlm] = useState({
    vendorPreset: store.vendorPreset,
    llmProvider: store.llmProvider,
    llmApiKey: store.llmApiKey,
    llmModel: store.llmModel,
    llmBaseUrl: store.llmBaseUrl,
    webSearchStrategy: store.webSearchStrategy,
    webSearchExtraBody: store.webSearchExtraBody,
    webSearchContextSize: store.webSearchContextSize,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const selectedPreset = VENDOR_PRESETS.find(p => p.id === llm.vendorPreset) ?? VENDOR_PRESETS[0]

  function applyPreset(preset: VendorPreset) {
    setLlm(prev => ({
      ...prev,
      vendorPreset: preset.id,
      llmProvider: preset.provider,
      llmBaseUrl: preset.baseUrl,
      llmModel: preset.defaultModel,
      webSearchStrategy: preset.webSearchStrategy,
      webSearchExtraBody: preset.webSearchExtraBody,
    }))
  }

  // ── Embedding draft state ────────────────────────────────────────────────
  const [emb, setEmb] = useState({
    embeddingApiKey: store.embeddingApiKey,
    embeddingModel: store.embeddingModel,
    embeddingDimensions: store.embeddingDimensions,
    embeddingBaseUrl: store.embeddingBaseUrl,
  })
  const [sys, setSys] = useState({ backendPort: String(store.backendPort) })

  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, 'idle' | 'ok' | 'error'>>({
    llm: 'idle', emb: 'idle', sys: 'idle',
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

          {/* LLM Section */}
          <SettingsCard
            icon={<Sparkles size={16} className="text-primary" />}
            title="LLM 配置"
            subtitle="Coordinator / Research / Evaluator Agent 共用"
            tooltip={
              <div className="space-y-1.5">
                <p>选择模型厂商后，Base URL 和联网策略会自动填充。</p>
                <p><strong>API Key</strong>：对应厂商的调用密钥。</p>
                <p><strong>Model</strong>：模型名称，可在预填值基础上修改。</p>
                <p><strong>Base URL</strong>：官方端点已预填，第三方中转需自行填入（需含 /v1）。</p>
                <p className="text-primary pt-1">💡 LLM 和 Embedding 可以复用同一 API Key。</p>
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
                web_search_strategy: llm.webSearchStrategy,
                web_search_extra_body: llm.webSearchExtraBody || undefined,
                web_search_context_size: llm.webSearchContextSize,
              })
            })}
          >
            {/* ── Vendor preset grid ── */}
            <Field label="选择模型厂商">
              <div className="grid grid-cols-6 gap-2">
                {VENDOR_PRESETS.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={llm.vendorPreset === preset.id}
                    onSelect={() => applyPreset(preset)}
                  />
                ))}
              </div>
            </Field>

            {/* ── Web search status badge ── */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium',
              selectedPreset.webSearchOk
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-surface-container text-secondary border border-outline-variant/20',
            )}>
              <span>{selectedPreset.webSearchOk ? '✓' : '—'}</span>
              <span>
                Research Agent 联网：
                {selectedPreset.webSearchOk
                  ? `实时联网搜索（${selectedPreset.webSearchNote}）`
                  : `不联网，使用模型自身知识（${selectedPreset.webSearchNote}）`}
              </span>
            </div>

            {/* ── Core fields ── */}
            <Field label="API Key">
              <SecretInput
                value={llm.llmApiKey}
                onChange={(v) => setLlm({ ...llm, llmApiKey: v })}
                placeholder="sk-..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Model" hint={selectedPreset.isCustom ? '填入厂商提供的模型名' : '可在预填值基础上修改'}>
                <input
                  value={llm.llmModel}
                  onChange={(e) => setLlm({ ...llm, llmModel: e.target.value })}
                  placeholder={selectedPreset.defaultModel || '例：gpt-4o'}
                  className={monoInputClass}
                />
              </Field>
              <Field
                label="Base URL"
                hint={
                  llm.vendorPreset === 'anthropic'
                    ? 'Anthropic SDK 自动附加 /v1，此处留空即可'
                    : '需以 /v1 结尾'
                }
              >
                <input
                  value={llm.llmBaseUrl}
                  onChange={(e) => setLlm({ ...llm, llmBaseUrl: e.target.value })}
                  placeholder={selectedPreset.isCustom ? 'https://openrouter.ai/api/v1' : selectedPreset.baseUrl}
                  className={monoInputClass}
                />
              </Field>
            </div>

            {/* ── Advanced toggle ── */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-on-surface transition-colors"
            >
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              高级设置
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-1 border-t border-outline-variant/10">
                {llm.webSearchStrategy === 'extra_body' && (
                  <Field
                    label="Web Search Extra Body"
                    hint="JSON 格式，作为 extra_body 传入 chat.completions（Qwen 已预填）"
                  >
                    <input
                      value={llm.webSearchExtraBody}
                      onChange={(e) => setLlm({ ...llm, webSearchExtraBody: e.target.value })}
                      placeholder='{"enable_search": true}'
                      className={monoInputClass}
                    />
                  </Field>
                )}
                {llm.webSearchStrategy === 'openai_responses' && (
                  <Field label="Web Search Context Size" hint="仅 OpenAI Responses API 生效">
                    <Select
                      value={llm.webSearchContextSize}
                      onValueChange={(v) => setLlm({ ...llm, webSearchContextSize: v as 'low' | 'medium' | 'high' })}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="SDK Provider" hint="通常无需修改，由厂商选择自动决定">
                  <Select
                    value={llm.llmProvider}
                    onValueChange={(v) => setLlm({ ...llm, llmProvider: v as 'openai' | 'anthropic' })}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI SDK</SelectItem>
                      <SelectItem value="anthropic">Anthropic SDK</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
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
              setBackendPort(Number(sys.backendPort) || 52777)
              flashStatus('sys', 'ok')
            }}
          >
            <Field label="后端端口" hint="默认 52777，修改后需重启后端服务">
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
              <Field label="数据库存储路径" hint="SQLite + LanceDB 存储位置">
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
