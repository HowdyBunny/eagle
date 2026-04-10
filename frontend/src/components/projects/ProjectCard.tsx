import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ArrowRight, Trash2, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/stores/project-store'
import { useAppStore } from '@/stores/app-store'
import StatusBadge from '@/components/shared/StatusBadge'
import type { ProjectResponse } from '@/types'

interface ProjectCardProps {
  project: ProjectResponse
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const selectProject = useAppStore((s) => s.selectProject)
  const clearProject = useAppStore((s) => s.clearProject)
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate to detail if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    navigate(`/projects/${project.id}`)
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectProject(project)
    navigate('/')
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(project.id)
      if (currentProjectId === project.id) {
        clearProject()
      }
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const date = new Date(project.created_at).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div onClick={handleCardClick} className="relative bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-xl transition-all overflow-hidden group cursor-pointer">
      {/* Left accent bar */}
      {project.status === 'active' && (
        <div className="absolute left-0 top-0 w-1 h-full bg-primary rounded-l-xl" />
      )}

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between mb-3">
          <StatusBadge status={project.status} variant="project" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-secondary flex items-center gap-1">
              <Calendar size={10} />
              {date}
            </span>
            <button
              onClick={() => setConfirming(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-red-500 p-0.5 rounded"
              title="删除项目"
            >
              <Trash2 size={13} />
            </button>
          </div>
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

      {/* Delete confirmation overlay */}
      {confirming && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-5 gap-3 rounded-xl">
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <p className="text-xs text-center text-on-surface leading-relaxed">
            删除项目会一并删除<span className="font-bold">对话内容和行业研究报告</span>，项目文件夹将移至回收站。
          </p>
          <p className="text-[11px] font-black text-center text-secondary">是否确认删除「{project.project_name}」？</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-secondary border border-outline-variant/20 hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
