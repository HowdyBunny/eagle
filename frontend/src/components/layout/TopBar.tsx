import { useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'

const routeTitles: Record<string, string> = {
  '/': '对话',
  '/projects': '招聘项目管理',
  '/talent': '人才库',
  '/research': '行业研究',
  '/settings': '系统设置',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const currentProject = useAppStore((s) => s.currentProject)
  const title = routeTitles[pathname] ?? '对话'

  return (
    <header className="sticky top-0 z-30 h-16 glass-overlay border-b border-outline-variant/10 flex items-center px-6 gap-4 shadow-sm">
      <div className="flex-1">
        <h1 className="font-headline font-black text-base tracking-tight text-on-surface">{title}</h1>
        {currentProject && pathname === '/' && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-0.5">
            {currentProject.project_name} · {currentProject.client_name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {pathname === '/research' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Eagle RA</span>
          </div>
        )}
      </div>
    </header>
  )
}
