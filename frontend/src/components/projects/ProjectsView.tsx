import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus } from 'lucide-react'
import { useProjectStore } from '@/stores/project-store'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import ProjectCard from './ProjectCard'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

export default function ProjectsView() {
  const { projects, loading, fetchProjects } = useProjectStore()
  const clearProject = useAppStore((s) => s.clearProject)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const navigate = useNavigate()

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const handleNewProject = () => {
    clearProject()
    clearMessages()
    navigate('/')
  }

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  }

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline font-black text-2xl tracking-tight text-on-surface">招聘项目</h2>
          <p className="text-sm text-secondary mt-0.5">管理所有猎头任务和客户需求 · <span className="text-secondary/60">点击项目卡片可以查看项目详细信息</span></p>
        </div>
        <button
          onClick={handleNewProject}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl kinetic-gradient text-white text-sm font-headline font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all scale-98-active"
        >
          <Plus size={16} />
          新建项目
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '全部项目', value: stats.total, sub: '个招聘任务' },
          { label: '进行中', value: stats.active, sub: '个活跃项目' },
          { label: '已完成', value: stats.completed, sub: '个项目' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm p-5 border-l-4 border-l-primary">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">{label}</p>
            <p className="font-headline font-black text-4xl tracking-tighter text-on-surface">{value}</p>
            <p className="text-xs text-secondary mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="暂无招聘项目"
          description="点击「新建项目」进入对话，与 Coordinator Agent 描述你的客户和职位"
          action={{ label: '新建项目', onClick: handleNewProject }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
