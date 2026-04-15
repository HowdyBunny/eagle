import { useState, useEffect } from 'react'
import { ExternalLink, Star, Pencil, Trash2, X, Save, RotateCcw, Briefcase, GraduationCap, MapPin, Clock, DollarSign, AlertTriangle, ClipboardList, Phone, Mail } from 'lucide-react'
import { useCandidateStore } from '@/stores/candidate-store'
import { listCandidateEvaluations } from '@/lib/api/evaluations'
import MatchDonut from '@/components/shared/MatchDonut'
import type { CandidateResponse, CandidateUpdate, CandidateEvaluationResponse } from '@/types'

interface CandidateDetailSheetProps {
  candidate: CandidateResponse | null
  open: boolean
  onClose: () => void
}

// ── Experience entries parsed from raw_structured_data ─────────────────────
interface ExperienceEntry {
  company?: string
  title?: string
  duration?: string
  description?: string
}

function parseExperiences(raw: Record<string, unknown> | null | undefined): ExperienceEntry[] {
  if (!raw) return []
  const exps = raw['experiences']
  if (!Array.isArray(exps)) return []
  return exps as ExperienceEntry[]
}

// ── Read-only detail pane ──────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  extension: { label: '插件', color: 'bg-purple-100 text-purple-700' },
  ca: { label: 'Agent', color: 'bg-blue-100 text-blue-700' },
  talent_pool: { label: '人才库', color: 'bg-green-100 text-green-700' },
}

function TriggerSourceBadge({ source }: { source: string | null }) {
  if (!source) return null
  const info = SOURCE_LABELS[source] ?? { label: source, color: 'bg-zinc-100 text-zinc-600' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${info.color}`}>
      {info.label}
    </span>
  )
}

function DetailView({
  candidate,
  onEdit,
  onDelete,
}: {
  candidate: CandidateResponse
  onEdit: () => void
  onDelete: () => void
}) {
  const confidence = candidate.confidence_score ?? 0
  const experiences = parseExperiences(candidate.raw_structured_data)
  const [evaluations, setEvaluations] = useState<CandidateEvaluationResponse[]>([])

  useEffect(() => {
    listCandidateEvaluations(candidate.id)
      .then(setEvaluations)
      .catch(() => {})
  }, [candidate.id])

  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-low/40">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl kinetic-gradient flex items-center justify-center text-white font-headline font-black text-2xl shadow-md shrink-0">
            {candidate.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-black text-xl text-on-surface truncate">{candidate.full_name}</h2>
            {candidate.current_title && (
              <p className="text-sm text-on-surface/80 mt-0.5">{candidate.current_title}</p>
            )}
            {candidate.current_company && (
              <p className="text-sm text-secondary mt-0.5">@ {candidate.current_company}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {candidate.location && (
                <span className="flex items-center gap-1 text-[11px] text-secondary">
                  <MapPin size={11} /> {candidate.location}
                </span>
              )}
              {candidate.years_experience != null && (
                <span className="flex items-center gap-1 text-[11px] text-secondary">
                  <Clock size={11} /> {candidate.years_experience} 年经验
                </span>
              )}
              {candidate.salary_range && (
                <span className="flex items-center gap-1 text-[11px] text-secondary">
                  <DollarSign size={11} /> {candidate.salary_range}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/20 text-[11px] font-bold text-secondary hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Pencil size={12} /> 编辑
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} /> 删除
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">

        {/* Confidence */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">信息置信度</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface-container">
              <div
                className="h-full rounded-full kinetic-gradient transition-all"
                style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${confidence < 60 ? 'text-red-500' : 'text-primary'}`}>
              {Math.round(confidence)}
            </span>
          </div>
          {confidence < 60 && (
            <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} /> 信息可能过时，建议重新查看 LinkedIn
            </p>
          )}
        </div>

        {/* Contact info */}
        {(candidate.phone || candidate.email) && (
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">联系方式</h3>
            <div className="flex flex-col gap-1.5">
              {candidate.phone && (
                <a href={`tel:${candidate.phone}`}
                  className="flex items-center gap-2 text-sm text-on-surface hover:text-primary transition-colors">
                  <Phone size={13} className="text-secondary shrink-0" /> {candidate.phone}
                </a>
              )}
              {candidate.email && (
                <a href={`mailto:${candidate.email}`}
                  className="flex items-center gap-2 text-sm text-on-surface hover:text-primary transition-colors">
                  <Mail size={13} className="text-secondary shrink-0" /> {candidate.email}
                </a>
              )}
            </div>
          </section>
        )}

        {/* Education */}
        {candidate.education && (
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
              <GraduationCap size={12} /> 教育背景
            </h3>
            <p className="text-sm text-on-surface bg-surface-container-low rounded-lg px-4 py-3">
              {candidate.education}
            </p>
          </section>
        )}

        {/* Work experience — structured if available, fallback to summary text */}
        {experiences.length > 0 ? (
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
              <Briefcase size={12} /> 工作经历
            </h3>
            <div className="space-y-4">
              {experiences.map((exp, i) => (
                <div key={i} className="relative pl-4 border-l-2 border-primary/20">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary/40" />
                  <p className="text-sm font-semibold text-on-surface leading-snug">
                    {exp.title ?? '职位未知'}
                  </p>
                  {exp.company && (
                    <p className="text-[12px] text-secondary mt-0.5">{exp.company}</p>
                  )}
                  {exp.duration && (
                    <p className="text-[11px] text-secondary/60 mt-0.5">{exp.duration}</p>
                  )}
                  {exp.description && (
                    <p className="text-[12px] text-on-surface/70 mt-1.5 leading-relaxed whitespace-pre-line">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : candidate.experience_summary ? (
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
              <Briefcase size={12} /> 工作经历摘要
            </h3>
            <div className="bg-surface-container-low rounded-lg px-4 py-3 space-y-2">
              {candidate.experience_summary.split(/\n+/).filter(Boolean).map((line, i) => (
                <p key={i} className="text-sm text-on-surface leading-relaxed">{line}</p>
              ))}
            </div>
          </section>
        ) : null}

        {/* Links */}
        {(candidate.linkedin_url || candidate.liepin_url) && (
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">个人主页</h3>
            <div className="flex flex-col gap-1.5">
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink size={13} /> LinkedIn
                </a>
              )}
              {candidate.liepin_url && (
                <a href={candidate.liepin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink size={13} /> 猎聘
                </a>
              )}
            </div>
          </section>
        )}

        {/* Evaluation history */}
        {evaluations.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
              <ClipboardList size={12} /> 评估历史
            </h3>
            <div className="space-y-2">
              {evaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                >
                  <div className="relative shrink-0 flex items-center justify-center" style={{ width: 40, height: 40 }}>
                    <MatchDonut score={ev.match_score ?? 0} size={40} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-on-surface truncate">{ev.project_name}</span>
                      <TriggerSourceBadge source={ev.trigger_source} />
                    </div>
                    <p className="text-[11px] text-secondary truncate">{ev.client_name}</p>
                    {ev.recommendation && (
                      <p className="text-[11px] text-secondary/70 mt-0.5 line-clamp-1">
                        {ev.recommendation.slice(0, 60)}{ev.recommendation.length > 60 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  {ev.evaluated_at && (
                    <span className="text-[10px] text-secondary/50 shrink-0">
                      {new Date(ev.evaluated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-secondary/60">
          <Star size={10} />
          入库：{new Date(candidate.created_at).toLocaleDateString('zh-CN')} ·
          更新：{new Date(candidate.updated_at).toLocaleDateString('zh-CN')}
        </div>
      </div>
    </div>
  )
}

// ── Edit form ──────────────────────────────────────────────────────────────
function EditForm({
  candidate,
  onCancel,
  onSaved,
}: {
  candidate: CandidateResponse
  onCancel: () => void
  onSaved: (updated: CandidateResponse) => void
}) {
  const { updateCandidate } = useCandidateStore()
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<CandidateUpdate>({
    full_name: candidate.full_name,
    current_title: candidate.current_title ?? '',
    current_company: candidate.current_company ?? '',
    location: candidate.location ?? '',
    years_experience: candidate.years_experience ?? undefined,
    salary_range: candidate.salary_range ?? '',
    education: candidate.education ?? '',
    phone: candidate.phone ?? '',
    email: candidate.email ?? '',
    linkedin_url: candidate.linkedin_url ?? '',
    liepin_url: candidate.liepin_url ?? '',
    experience_summary: candidate.experience_summary ?? '',
  })

  const set = (field: keyof CandidateUpdate, val: string | number | null) =>
    setDraft((d) => ({ ...d, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateCandidate(candidate.id, draft)
      onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface-container-low border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/30 transition-colors'
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5'

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-4 border-b border-outline-variant/10 flex items-center justify-between">
        <h3 className="font-headline font-bold text-sm text-on-surface">编辑候选人信息</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-secondary hover:text-on-surface transition-colors">
            <RotateCcw size={12} /> 取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg kinetic-gradient text-white text-[11px] font-semibold disabled:opacity-50 transition-opacity"
          >
            <Save size={12} /> {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>姓名</label>
            <input className={inputCls} value={draft.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>职位</label>
            <input className={inputCls} value={draft.current_title ?? ''} onChange={(e) => set('current_title', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>公司</label>
            <input className={inputCls} value={draft.current_company ?? ''} onChange={(e) => set('current_company', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>所在地</label>
            <input className={inputCls} value={draft.location ?? ''} onChange={(e) => set('location', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>工作年限</label>
            <input type="number" className={inputCls} value={draft.years_experience ?? ''} onChange={(e) => set('years_experience', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className={labelCls}>薪资范围</label>
            <input className={inputCls} value={draft.salary_range ?? ''} onChange={(e) => set('salary_range', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>教育背景</label>
            <input className={inputCls} value={draft.education ?? ''} onChange={(e) => set('education', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>手机号</label>
            <input className={inputCls} value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} placeholder="138 0000 0000" />
          </div>
          <div>
            <label className={labelCls}>邮箱</label>
            <input type="email" className={inputCls} value={draft.email ?? ''} onChange={(e) => set('email', e.target.value || null)} placeholder="example@company.com" />
          </div>
          <div>
            <label className={labelCls}>LinkedIn URL</label>
            <input className={inputCls} value={draft.linkedin_url ?? ''} onChange={(e) => set('linkedin_url', e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>猎聘 URL</label>
            <input className={inputCls} value={draft.liepin_url ?? ''} onChange={(e) => set('liepin_url', e.target.value || null)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>工作经历摘要 <span className="normal-case font-normal text-secondary/60">（修改后会自动重新生成向量）</span></label>
            <textarea
              rows={8}
              className={`${inputCls} resize-none`}
              value={draft.experience_summary ?? ''}
              onChange={(e) => set('experience_summary', e.target.value || null)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm({
  candidate,
  onCancel,
  onDeleted,
}: {
  candidate: CandidateResponse
  onCancel: () => void
  onDeleted: () => void
}) {
  const { deleteCandidate } = useCandidateStore()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteCandidate(candidate.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full items-center justify-center px-8 gap-5">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
        <Trash2 size={24} className="text-red-600" />
      </div>
      <div className="text-center">
        <p className="font-headline font-bold text-base text-on-surface">确认删除此候选人？</p>
        <p className="text-sm text-secondary mt-1">
          将从人才库中永久移除 <strong>{candidate.full_name}</strong>，同时清除其向量数据，操作不可撤销。
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="px-5 py-2 rounded-xl border border-outline-variant/20 text-sm font-bold text-secondary hover:text-on-surface transition-colors">
          取消
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {deleting ? '删除中…' : '确认删除'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
type PanelMode = 'view' | 'edit' | 'delete'

export default function CandidateDetailSheet({ candidate: initialCandidate, open, onClose }: CandidateDetailSheetProps) {
  const [mode, setMode] = useState<PanelMode>('view')
  const [candidate, setCandidate] = useState<CandidateResponse | null>(initialCandidate)

  // Sync when parent changes the selected candidate
  if (initialCandidate?.id !== candidate?.id) {
    setCandidate(initialCandidate)
    setMode('view')
  }

  if (!open || !candidate) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={() => { if (mode !== 'delete') onClose() }}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-surface-container-lowest shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <X size={16} />
        </button>

        {mode === 'view' && (
          <DetailView
            candidate={candidate}
            onEdit={() => setMode('edit')}
            onDelete={() => setMode('delete')}
          />
        )}
        {mode === 'edit' && (
          <EditForm
            candidate={candidate}
            onCancel={() => setMode('view')}
            onSaved={(updated) => { setCandidate(updated); setMode('view') }}
          />
        )}
        {mode === 'delete' && (
          <DeleteConfirm
            candidate={candidate}
            onCancel={() => setMode('view')}
            onDeleted={onClose}
          />
        )}
      </div>
    </div>
  )
}
