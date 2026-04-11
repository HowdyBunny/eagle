/**
 * OnboardingModal — 首次启动引导弹窗
 *
 * 两步向导：
 *   Step 1: LLM 配置（provider / api key / model / base url）
 *   Step 2: Embedding 配置（api key / model / dimensions / base url）
 *           提供"与 LLM 相同"一键复用选项
 *
 * 点击 X 或"稍后配置"可关闭，下次启动如果仍未配置会再次弹出。
 * "完成配置"时同步保存到 zustand store 并 best-effort 推送到后端 runtime。
 */

import { useState, useEffect } from 'react'
import { X, Sparkles, Database, Eye, EyeOff, ChevronRight, Check, Copy } from 'lucide-react'
import { useAppStore, type LLMProvider } from '@/stores/app-store'
import { useUIStore } from '@/stores/ui-store'
import { updateRuntimeSettings } from '@/lib/api/settings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ── Reusable input primitives (same style as SettingsView) ────────────────────

const inputCls =
  'w-full bg-surface-container border-b-2 border-transparent focus:border-primary rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

const monoCls = `${inputCls} font-mono`

const selectTriggerCls =
  'w-full h-auto bg-surface-container border-0 border-b-2 border-transparent rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5">
      {children}
    </label>
  )
}

function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
        className={`${monoCls} pr-10 disabled:opacity-50`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors disabled:opacity-30"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
              i < current
                ? 'kinetic-gradient text-white'
                : i === current
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-surface-container text-secondary'
            }`}
          >
            {i < current ? <Check size={10} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-0.5 rounded-full transition-all ${i < current ? 'bg-primary' : 'bg-outline-variant/30'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingModal() {
  const { isOnboardingOpen, closeOnboarding } = useUIStore()
  const { updateSettings } = useAppStore()
  const stored = useAppStore()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1 — LLM draft
  const [llm, setLlm] = useState({
    llmProvider: stored.llmProvider,
    llmApiKey: stored.llmApiKey,
    llmModel: stored.llmModel,
    llmBaseUrl: stored.llmBaseUrl,
  })

  // Step 2 — Embedding draft
  const [sameAsLlm, setSameAsLlm] = useState(false)
  const [emb, setEmb] = useState({
    embeddingApiKey: stored.embeddingApiKey,
    embeddingModel: stored.embeddingModel,
    embeddingDimensions: stored.embeddingDimensions,
    embeddingBaseUrl: stored.embeddingBaseUrl,
  })

  // Keep embedding in sync when "same as LLM" is checked
  useEffect(() => {
    if (sameAsLlm) {
      setEmb((e) => ({
        ...e,
        embeddingApiKey: llm.llmApiKey,
        embeddingBaseUrl: llm.llmBaseUrl,
      }))
    }
  }, [sameAsLlm, llm.llmApiKey, llm.llmBaseUrl])

  // Reset to step 0 each time modal opens
  useEffect(() => {
    if (isOnboardingOpen) {
      setStep(0)
      setSameAsLlm(false)
      // Refresh drafts from store in case user partially saved via Settings
      const s = useAppStore.getState()
      setLlm({
        llmProvider: s.llmProvider,
        llmApiKey: s.llmApiKey,
        llmModel: s.llmModel,
        llmBaseUrl: s.llmBaseUrl,
      })
      setEmb({
        embeddingApiKey: s.embeddingApiKey,
        embeddingModel: s.embeddingModel,
        embeddingDimensions: s.embeddingDimensions,
        embeddingBaseUrl: s.embeddingBaseUrl,
      })
    }
  }, [isOnboardingOpen])

  if (!isOnboardingOpen) return null

  const handleComplete = async () => {
    setSaving(true)
    // 1. Save to zustand (persisted to localStorage immediately)
    updateSettings({ ...llm, ...emb })
    // 2. Best-effort push to backend runtime (may fail if backend not ready yet)
    try {
      await updateRuntimeSettings({
        llm_provider: llm.llmProvider,
        llm_api_key: llm.llmApiKey,
        llm_model: llm.llmModel,
        llm_base_url: llm.llmBaseUrl || undefined,
        embedding_api_key: emb.embeddingApiKey,
        embedding_model: emb.embeddingModel,
        embedding_base_url: emb.embeddingBaseUrl || undefined,
        embedding_dimensions: emb.embeddingDimensions,
      })
    } catch {
      // Backend may not be ready during first setup — settings are in localStorage,
      // they'll be applied on next backend start or via Settings → Save.
    }
    setSaving(false)
    closeOnboarding()
  }

  const stepTitles = ['LLM 配置', 'Embedding 配置']
  const stepIcons = [
    <Sparkles size={18} className="text-primary" />,
    <Database size={18} className="text-primary" />,
  ]

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeOnboarding}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">
                首次配置 · 步骤 {step + 1} / 2
              </p>
              <h2 className="font-headline font-black text-xl text-on-surface flex items-center gap-2">
                {stepIcons[step]}
                {stepTitles[step]}
              </h2>
            </div>
            <button
              onClick={closeOnboarding}
              className="text-secondary/60 hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
          <StepIndicator current={step} total={2} />
        </div>

        {/* Step content */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {step === 0 && (
            <>
              <p className="text-sm text-secondary leading-relaxed">
                Eagle 使用 LLM 驱动三个 Agent（CA / RA / EA）。填写你的 API Key 和模型名称即可开始。
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <Select
                    value={llm.llmProvider}
                    onValueChange={(v) => setLlm({ ...llm, llmProvider: v as LLMProvider })}
                  >
                    <SelectTrigger className={selectTriggerCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>模型名称</Label>
                  <input
                    value={llm.llmModel}
                    onChange={(e) => setLlm({ ...llm, llmModel: e.target.value })}
                    placeholder="gpt-4o"
                    className={monoCls}
                  />
                </div>
              </div>

              <div>
                <Label>API Key <span className="text-red-400 normal-case font-normal">*</span></Label>
                <SecretInput
                  value={llm.llmApiKey}
                  onChange={(v) => setLlm({ ...llm, llmApiKey: v })}
                  placeholder="sk-..."
                />
              </div>

              <div>
                <Label>Base URL <span className="text-secondary/50 normal-case font-normal text-[10px]">可选，第三方代理</span></Label>
                <input
                  value={llm.llmBaseUrl}
                  onChange={(e) => setLlm({ ...llm, llmBaseUrl: e.target.value })}
                  placeholder="https://your-proxy.com/v1"
                  className={monoCls}
                />
                <p className="text-[11px] text-secondary mt-1">
                  openai 需带 /v1；anthropic 不带；留空走官方端点
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-secondary leading-relaxed">
                Embedding 用于候选人和 JD 的向量搜索。如果你的 LLM Provider 同时支持 Embedding，可以直接复用。
              </p>

              {/* "Same as LLM" shortcut */}
              <button
                type="button"
                onClick={() => setSameAsLlm(!sameAsLlm)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  sameAsLlm
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/30 hover:border-primary/40 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  sameAsLlm ? 'border-primary kinetic-gradient' : 'border-outline-variant/50'
                }`}>
                  {sameAsLlm && <Check size={11} className="text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                    <Copy size={13} className="text-primary" />
                    与 LLM 使用相同的 API Key 和 Base URL
                  </p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    适用于 OpenAI、第三方中转等同时提供 Embedding 的服务
                  </p>
                </div>
              </button>

              <div>
                <Label>API Key <span className="text-red-400 normal-case font-normal">*</span></Label>
                <SecretInput
                  value={emb.embeddingApiKey}
                  onChange={(v) => setEmb({ ...emb, embeddingApiKey: v })}
                  placeholder="sk-..."
                  disabled={sameAsLlm}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>模型名称</Label>
                  <input
                    value={emb.embeddingModel}
                    onChange={(e) => setEmb({ ...emb, embeddingModel: e.target.value })}
                    placeholder="text-embedding-3-small"
                    className={monoCls}
                  />
                </div>
                <div>
                  <Label>向量维度</Label>
                  <input
                    type="number"
                    value={emb.embeddingDimensions}
                    onChange={(e) => setEmb({ ...emb, embeddingDimensions: Number(e.target.value) || 1536 })}
                    placeholder="1536"
                    className={monoCls}
                  />
                </div>
              </div>

              <div>
                <Label>Base URL <span className="text-secondary/50 normal-case font-normal text-[10px]">可选</span></Label>
                <input
                  value={emb.embeddingBaseUrl}
                  onChange={(e) => setEmb({ ...emb, embeddingBaseUrl: e.target.value })}
                  placeholder="https://your-proxy.com/v1"
                  disabled={sameAsLlm}
                  className={`${monoCls} disabled:opacity-50`}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
          {step === 0 ? (
            <button
              onClick={closeOnboarding}
              className="text-sm text-secondary hover:text-on-surface transition-colors"
            >
              稍后配置
            </button>
          ) : (
            <button
              onClick={() => setStep(0)}
              className="text-sm text-secondary hover:text-on-surface transition-colors flex items-center gap-1"
            >
              ← 上一步
            </button>
          )}

          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              disabled={!llm.llmApiKey.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-40 disabled:shadow-none"
            >
              下一步 <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving || !emb.embeddingApiKey.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-40 disabled:shadow-none"
            >
              {saving ? '保存中...' : (<><Check size={15} /> 完成配置</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
