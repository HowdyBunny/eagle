import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ExternalLink, Star } from 'lucide-react'
import type { CandidateResponse } from '@/types'

interface CandidateDetailSheetProps {
  candidate: CandidateResponse | null
  open: boolean
  onClose: () => void
}

export default function CandidateDetailSheet({ candidate, open, onClose }: CandidateDetailSheetProps) {
  if (!candidate) return null

  const confidence = candidate.confidence_score ?? 0

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-headline font-black text-lg">候选人档案</SheetTitle>
        </SheetHeader>

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full kinetic-gradient flex items-center justify-center text-white font-headline font-black text-xl shadow">
            {candidate.full_name.charAt(0)}
          </div>
          <div>
            <h3 className="font-headline font-black text-lg text-on-surface">{candidate.full_name}</h3>
            <p className="text-sm text-secondary">{candidate.current_title}</p>
            <p className="text-sm text-secondary">{candidate.current_company}</p>
          </div>
        </div>

        {/* Confidence score */}
        <div className="mb-6 p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
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
            <p className="text-[11px] text-red-500 mt-1.5">⚠️ 信息可能过时，建议重新查看 LinkedIn</p>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {[
            { label: '所在地', value: candidate.location },
            { label: '工作年限', value: candidate.years_experience != null ? `${candidate.years_experience} 年` : null },
            { label: '薪资范围', value: candidate.salary_range },
            { label: '教育背景', value: candidate.education },
            { label: '来源平台', value: candidate.source_platform },
          ].filter((f) => f.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">{label}</p>
              <p className="text-sm text-on-surface">{value}</p>
            </div>
          ))}

          {/* Links */}
          {(candidate.linkedin_url || candidate.liepin_url) && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">个人主页</p>
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
            </div>
          )}

          {candidate.experience_summary && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">工作经历摘要</p>
              <p className="text-sm text-on-surface leading-relaxed bg-surface-container-low rounded-lg p-3">
                {candidate.experience_summary}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-1.5 text-[10px] text-secondary/60">
          <Star size={10} />
          入库时间：{new Date(candidate.created_at).toLocaleDateString('zh-CN')}
        </div>
      </SheetContent>
    </Sheet>
  )
}
