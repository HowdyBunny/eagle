import { MessageSquare, FolderOpen, Users, BarChart2, Settings, PlusCircle, Rocket } from 'lucide-react';
import { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (v: ViewType) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'talent', label: 'Talent Pool', icon: Users },
    { id: 'research', label: 'Industry Research', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside className="flex flex-col h-full py-6 px-4 bg-slate-50 w-64 border-r border-zinc-200 shrink-0">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="w-10 h-10 kinetic-gradient rounded-lg flex items-center justify-center shadow-lg">
          <Rocket className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tighter text-zinc-900 uppercase font-headline leading-none">The Kinetic Elite</h1>
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">Apex Recruitment AI</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewType)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                isActive
                  ? 'text-yellow-700 font-semibold border-r-4 border-yellow-600 bg-zinc-100 rounded-r-none'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-700' : 'group-hover:text-primary'}`} />
              <span className="text-sm tracking-tight font-headline">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-2">
        <button className="w-full kinetic-gradient text-white py-3 rounded-lg font-headline font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition-all scale-98-active">
          <PlusCircle className="w-5 h-5" />
          New Search
        </button>
      </div>
    </aside>
  );
}
