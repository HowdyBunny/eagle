import { useState } from 'react'
import { X, ChevronDown, ChevronUp, FileText, AlertTriangle, Star, MessageSquare } from 'lucide-react'
import type { ProjectCandidateResponse } from '@/types'
import MatchDonut from '@/components/shared/MatchDonut'

interface EvaluationReportDrawerProps {
  evaluation: ProjectCandidateResponse | null
  open: boolean
  onClose: () => void
}

const DIMENSION_LABELS: Record<string, string> = {
  '技能匹配': '技能匹配',
  '经验年限': '经验年限',
  '地点匹配': '地点匹配',
  '行业背景': '行业背景',
  '管理经验': '管理经验',
  '薪资匹配': '薪资匹配',
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-primary/70'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function EvaluationReportDrawer({ evaluation, open, onClose }: EvaluationReportDrawerProps) {
  const [showRaw, setShowRaw] = useState(false)

  if (!open || !evaluation) return null

  const candidateName = evaluation.candidate?.full_name ?? '候选人'
  const score = evaluation.match_score ?? 0
  const dimensionScores = evaluation.dimension_scores ?? {}

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
                <AlertTriangle size={12} /> 风险提示
              </h3>
              <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl px-4 py-3">
                <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">{evaluation.risk_flags}</p>
              </div>
            </section>
          )}

          {/* Hunter feedback */}
          {evaluation.hunter_feedback && (
            <section>
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary mb-3">
                <MessageSquare size={12} /> 猎头反馈
              </h3>
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="text-sm text-on-surface leading-relaxed">{evaluation.hunter_feedback}</p>
              </div>
            </section>
          )}

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
      </div>
    </div>
  )
}
