import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Calendar, MessageSquare, User, FileText, ClipboardList,
} from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { getProject } from '@/lib/api/projects'
import { listProjectCandidates } from '@/lib/api/evaluations'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import MatchDonut from '@/components/shared/MatchDonut'
import EvaluationReportDrawer from './EvaluationReportDrawer'
import CandidateDetailSheet from '@/components/talent/CandidateDetailSheet'
import type { ProjectResponse, CandidateResponse, ProjectCandidateResponse } from '@/types'

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

function RequirementTags({ profile }: { profile: Record<string, unknown> | null }) {
  if (!profile) return null
  const tags: string[] = []
  if (typeof profile.location === 'string') tags.push(`📍 ${profile.location}`)
  if (typeof profile.role_summary === 'string') tags.push(profile.role_summary)
  if (Array.isArray(profile.hard_requirements)) {
    profile.hard_requirements.slice(0, 3).forEach((r) => {
      if (typeof r === 'string') tags.push(r)
    })
  }
  if (Array.isArray(profile.hard_skills)) {
    profile.hard_skills.slice(0, 3).forEach((s) => {
      if (typeof s === 'string') tags.push(s)
    })
  }
  if (typeof profile.salary_range === 'string') tags.push(`💰 ${profile.salary_range}`)
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-full bg-surface-container text-xs text-secondary border border-outline-variant/10"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

export default function ProjectDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const selectProject = useAppStore((s) => s.selectProject)

  const [project, setProject] = useState<ProjectResponse | null>(null)
  const [candidates, setCandidates] = useState<ProjectCandidateResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEval, setSelectedEval] = useState<ProjectCandidateResponse | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResponse | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getProject(id), listProjectCandidates(id)])
      .then(([proj, cands]) => {
        setProject(proj)
        setCandidates(cands.filter((c) => c.evaluated_at !== null))
      })
      .catch(() => navigate('/projects'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleEnterChat = () => {
    if (!project) return
    selectProject(project)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!project) return null

  const date = new Date(project.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto px-6 py-8 space-y-8">

        {/* Back nav */}
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-on-surface transition-colors"
        >
          <ArrowLeft size={15} /> 项目列表
        </Link>

        {/* Project info card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
          {project.status === 'active' && (
            <div className="h-1 w-full kinetic-gradient" />
          )}
          <div className="p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <StatusBadge status={project.status} variant="project" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    {project.mode === 'precise' ? '精准模式' : '探索模式'}
                  </span>
                </div>
                <h1 className="font-headline font-black text-2xl text-on-surface tracking-tight leading-tight">
                  {project.project_name}
                </h1>
                <p className="text-base text-secondary mt-1">{project.client_name}</p>
                <div className="flex items-center gap-1.5 text-xs text-secondary/70 mt-2">
                  <Calendar size={12} />
                  {date}
                </div>
                <RequirementTags profile={project.requirement_profile} />
              </div>
              <button
                onClick={handleEnterChat}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active shrink-0"
              >
                <MessageSquare size={15} /> 进入对话
              </button>
            </div>

            {project.jd_raw && (
              <div className="mt-5 pt-5 border-t border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">职位描述</p>
                <p className="text-sm text-secondary leading-relaxed line-clamp-4">{project.jd_raw}</p>
              </div>
            )}
          </div>
        </div>

        {/* Evaluated candidates section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-headline font-black text-lg text-on-surface">
              <ClipboardList size={18} className="text-primary" />
              已评估候选人
              {candidates.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {candidates.length}
                </span>
              )}
            </h2>
          </div>

          {candidates.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="暂无评估记录"
              description="通过浏览器插件采集候选人或在 AI 对话中触发评估，结果将显示在这里"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((pc) => (
                <EvaluatedCandidateCard
                  key={pc.id}
                  pc={pc}
                  onOpenReport={() => setSelectedEval(pc)}
                  onOpenCandidate={() => pc.candidate && setSelectedCandidate(pc.candidate)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Drawers */}
      <EvaluationReportDrawer
        evaluation={selectedEval}
        open={selectedEval !== null}
        onClose={() => setSelectedEval(null)}
      />
      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={selectedCandidate !== null}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  )
}

interface EvaluatedCandidateCardProps {
  pc: ProjectCandidateResponse
  onOpenReport: () => void
  onOpenCandidate: () => void
}

function EvaluatedCandidateCard({ pc, onOpenReport, onOpenCandidate }: EvaluatedCandidateCardProps) {
  const candidate = pc.candidate
  const score = pc.match_score ?? 0

  const evaluatedAt = pc.evaluated_at
    ? new Date(pc.evaluated_at).toLocaleDateString('zh-CN', {
        month: 'short', day: 'numeric',
      })
    : null

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      {/* Top row: donut + name */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 52, height: 52 }}>
          <MatchDonut score={score} size={52} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-headline font-bold text-sm text-on-surface truncate">
            {candidate?.full_name ?? '未知姓名'}
          </p>
          {candidate?.current_title && (
            <p className="text-xs text-secondary truncate">{candidate.current_title}</p>
          )}
          {candidate?.current_company && (
            <p className="text-[11px] text-secondary/60 truncate">@ {candidate.current_company}</p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {evaluatedAt && (
          <span className="flex items-center gap-1 text-[10px] text-secondary/60">
            <Calendar size={10} /> {evaluatedAt}
          </span>
        )}
        <TriggerSourceBadge source={pc.trigger_source} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1 border-t border-outline-variant/10">
        <button
          onClick={onOpenReport}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <FileText size={12} /> 评估报告
        </button>
        <button
          onClick={onOpenCandidate}
          disabled={!candidate}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30"
        >
          <User size={12} /> 候选人信息
        </button>
      </div>
    </div>
  )
}
