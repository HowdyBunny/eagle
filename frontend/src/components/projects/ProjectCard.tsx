import { useNavigate } from 'react-router-dom'
import { Calendar, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import StatusBadge from '@/components/shared/StatusBadge'
import type { ProjectResponse } from '@/types'

interface ProjectCardProps {
  project: ProjectResponse
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const selectProject = useAppStore((s) => s.selectProject)
  const navigate = useNavigate()

  const handleSelect = () => {
    selectProject(project)
    navigate('/')
  }

  const date = new Date(project.created_at).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="relative bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
      {/* Left accent bar */}
      {project.status === 'active' && (
        <div className="absolute left-0 top-0 w-1 h-full bg-primary rounded-l-xl" />
      )}

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between mb-3">
          <StatusBadge status={project.status} variant="project" />
          <span className="text-[10px] text-secondary flex items-center gap-1">
            <Calendar size={10} />
            {date}
          </span>
        </div>

        <h3 className="font-headline font-black text-base text-on-surface tracking-tight leading-tight mb-1">
          {project.project_name}
        </h3>
        <p className="text-sm text-secondary mb-4">{project.client_name}</p>

        {project.jd_raw && (
          <p className="text-xs text-secondary leading-relaxed line-clamp-2 mb-4">
            {project.jd_raw}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
            {project.mode === 'precise' ? '精准模式' : '探索模式'}
          </span>
          <button
            onClick={handleSelect}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-headline font-semibold text-primary hover:bg-primary/5 transition-colors group-hover:translate-x-0.5 transition-transform"
          >
            选择项目 <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
