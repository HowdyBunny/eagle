import { NavLink, useNavigate } from 'react-router-dom'
import { MessageSquare, FolderOpen, Users, BarChart2, Settings, PlusCircle } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'

const navItems = [
  { to: '/', icon: MessageSquare, label: '对话' },
  { to: '/projects', icon: FolderOpen, label: '招聘项目' },
  { to: '/talent', icon: Users, label: '人才库' },
  { to: '/research', icon: BarChart2, label: '行业研究' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export default function Sidebar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const clearProject = useAppStore((s) => s.clearProject)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const navigate = useNavigate()

  const handleNewProject = () => {
    clearProject()
    clearMessages()
    navigate('/')
  }

  return (
    <aside className="w-64 shrink-0 h-screen bg-surface-container-lowest border-r border-outline-variant/15 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-outline-variant/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg kinetic-gradient flex items-center justify-center">
            <span className="text-white font-headline font-black text-sm">E</span>
          </div>
          <div>
            <p className="font-headline font-black text-sm tracking-tight text-on-surface">Eagle</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">猎头 AI 助手</p>
          </div>
        </div>
      </div>

      {/* Current Project */}
      {currentProject && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">当前项目</p>
          <p className="text-xs font-semibold text-on-surface truncate">{currentProject.project_name}</p>
          <p className="text-[10px] text-secondary truncate">{currentProject.client_name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-yellow-700 font-semibold border-r-4 border-yellow-600 bg-zinc-100'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
              }`
            }
          >
            <Icon size={18} />
            <span className="font-headline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* New Project CTA → fresh chat */}
      <div className="p-4 border-t border-outline-variant/10">
        <button
          onClick={handleNewProject}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all scale-98-active"
        >
          <PlusCircle size={16} />
          新建项目
        </button>
      </div>
    </aside>
  )
}
