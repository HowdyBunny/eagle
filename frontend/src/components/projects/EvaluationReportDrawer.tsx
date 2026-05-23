import { useEffect, useState } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Star,
  MessageSquare,
  Loader2,
  Check,
} from 'lucide-react'
import type { ProjectCandidateResponse, ProjectCandidateStatus } from '@/types'
import MatchDonut from '@/components/shared/MatchDonut'
import { updateProjectCandidate } from '@/lib/api/evaluations'

interface EvaluationReportDrawerProps {
  evaluation: ProjectCandidateResponse | null
  open: boolean
  onClose: () => void
  /**
   * When true the project-level status and hunter feedback can be edited
   * inline. Callers that don't have a sensible PATCH target (or want a
   * pure read-only view) should leave this off.
   */
  editable?: boolean
  /** Called with the updated record after a successful PATCH. */
  onUpdated?: (updated: ProjectCandidateResponse) => void
}

const DIMENSION_LABELS: Record<string, string> = {
  '技能匹配': '技能匹配',
  '经验年限': '经验年限',
  '地点匹配': '地点匹配',
  '行业背景': '行业背景',
  '管理经验': '管理经验',
  '薪资匹配': '薪资匹配',
}

// Project-level status options. The labels mirror the lifecycle the hunter
// drives from this drawer: hand off to client (recommended), schedule interview,
// or drop the candidate.
const PROJECT_STATUSES: { key: ProjectCandidateStatus; label: string; desc: string; tint: string }[] = [
  { key: 'pending', label: '待定', desc: '尚未给出客户反馈', tint: 'bg-zinc-100 text-secondary border-zinc-200' },
  { key: 'recommended', label: '已推荐', desc: '已发推荐给客户', tint: 'bg-primary/10 text-primary border-primary/30' },
  { key: 'interviewed', label: '已约面', desc: '客户安排面试中', tint: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'eliminated', label: '已淘汰', desc: '客户或我方否决', tint: 'bg-red-50 text-red-600 border-red-200' },
  { key: 'failed', label: '失败', desc: '评估错误', tint: 'bg-red-100 text-red-700 border-red-300' },
]

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-primary/70'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function EvaluationReportDrawer({
  evaluation,
  open,
  onClose,
  editable = false,
  onUpdated,
}: EvaluationReportDrawerProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [editStatus, setEditStatus] = useState<ProjectCandidateStatus | null>(null)
  const [editFeedback, setEditFeedback] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Reset the editor when the drawer is opened with a new evaluation.
  useEffect(() => {
    if (open && evaluation) {
      setEditStatus(evaluation.status)
      setEditFeedback(evaluation.hunter_feedback ?? '')
      setSavedAt(null)
    }
  }, [open, evaluation?.id, evaluation?.status, evaluation?.hunter_feedback])

  if (!open || !evaluation) return null

  const candidateName = evaluation.candidate?.full_name ?? '候选人'
  const score = evaluation.match_score ?? 0
  const dimensionScores = evaluation.dimension_scores ?? {}

  const dirty =
    editable &&
    (editStatus !== evaluation.status ||
      (editFeedback || null) !== (evaluation.hunter_feedback ?? null))

  const handleSave = async () => {
    if (!editable || !dirty || !editStatus) return
    setSaving(true)
    try {
      const updated = await updateProjectCandidate(
        evaluation.project_id,
        evaluation.candidate_id,
        {
          status: editStatus,
          // PATCH treats null/undefined as "leave alone"; we always send the
          // current draft so clearing the textarea also clears the field.
          hunter_feedback: editFeedback || null,
        },
      )
      onUpdated?.(updated)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
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

        {/* Hero */}
        <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-low/40">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl kinetic-gradient flex items-center justify-center text-white font-headline font-black text-xl shadow-md">
                {candidateName.charAt(0)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-headline font-black text-xl text-on-surface">{candidateName}</h2>
              {evaluation.candidate?.current_title && (
                <p className="text-sm text-secondary mt-0.5">{evaluation.candidate.current_title}</p>
              )}
              {evaluation.candidate?.current_company && (
                <p className="text-xs text-secondary/70 mt-0.5">@ {evaluation.candidate.current_company}</p>
              )}
            </div>
            <div className="shrink-0 relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
              <MatchDonut score={score} size={64} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* Project status editor (only when editable) */}
          {editable && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
                项目状态
              </h3>
              <div className="flex flex-wrap gap-2">
                {PROJECT_STATUSES.filter((s) => s.key !== 'failed' || evaluation.status === 'failed').map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setEditStatus(s.key)}
                    title={s.desc}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left transition-all ${
                      editStatus === s.key
                        ? `${s.tint} shadow-sm`
                        : 'border-outline-variant/20 text-secondary hover:border-primary/20 bg-surface-container-lowest'
                    }`}
                  >
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className="text-[10px] opacity-75">{s.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Dimension scores */}
          {Object.keys(dimensionScores).length > 0 && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">维度得分</h3>
              <div className="space-y-2.5">
                {Object.entries(dimensionScores).map(([dim, val]) => (
                  <div key={dim} className="flex items-center gap-3">
                    <span className="text-xs text-secondary w-16 shrink-0">{DIMENSION_LABELS[dim] ?? dim}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-container">
                      <div
                        className={`h-full rounded-full transition-all ${scoreColor(val)}`}
                        style={{ width: `${Math.min(100, val)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-on-surface w-8 text-right">{val}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendation */}
          {evaluation.recommendation && (
            <section>
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
                <Star size={12} /> 推荐理由
              </h3>
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="text-sm text-on-surface leading-relaxed">{evaluation.recommendation}</p>
              </div>
            </section>
          )}

          {/* Risk flags */}
          {evaluation.risk_flags && (
            <section>
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
                <AlertTriangle size={12} /> 待猎头继续沟通的事项
              </h3>
              <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl px-4 py-3">
                <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">{evaluation.risk_flags}</p>
              </div>
            </section>
          )}

          {/* Hunter feedback */}
          <section>
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
              <MessageSquare size={12} /> 猎头反馈
            </h3>
            {editable ? (
              <textarea
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                placeholder="记录你对这个候选人在项目中的看法，例如：技术够但管理经验略弱..."
                rows={3}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-secondary/40 outline-none border border-transparent focus:border-primary/20 transition-colors resize-none"
              />
            ) : evaluation.hunter_feedback ? (
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="text-sm text-on-surface leading-relaxed">{evaluation.hunter_feedback}</p>
              </div>
            ) : (
              <p className="text-xs text-secondary/50 italic">尚无反馈</p>
            )}
          </section>

          {/* Raw LLM output (debug) */}
          {evaluation.llm_raw_output && (
            <section>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-on-surface transition-colors"
              >
                <FileText size={12} />
                LLM 原始输出
                {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showRaw && (
                <pre className="mt-3 p-4 bg-surface-container rounded-xl text-xs text-secondary/80 whitespace-pre-wrap break-all overflow-auto max-h-64 font-mono">
                  {evaluation.llm_raw_output}
                </pre>
              )}
            </section>
          )}
        </div>

        {/* Footer save bar (only when editable) */}
        {editable && (
          <div className="border-t border-outline-variant/10 px-8 py-4 flex items-center justify-between gap-3 bg-surface-container-low/30">
            <p className="text-[11px] text-secondary">
              {dirty ? '有未保存的修改' : savedAt ? '已保存' : '未修改'}
            </p>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> 保存中
                </>
              ) : savedAt ? (
                <>
                  <Check size={13} /> 已保存
                </>
              ) : (
                '保存修改'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
