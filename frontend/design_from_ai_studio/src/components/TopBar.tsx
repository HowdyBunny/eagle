import { Search, Bell, UserCircle } from 'lucide-react';
import { ViewType } from '../types';

const viewTitles: Record<ViewType, string> = {
  chat: 'Coordinator Agent (CA) - Active',
  projects: 'Recruitment Projects',
  talent: 'Talent Pool',
  research: 'Industry Research',
  settings: 'Settings'
};

export function TopBar({ currentView }: { currentView: ViewType }) {
  return (
    <header className="flex justify-between items-center w-full px-8 py-4 h-16 bg-white/70 backdrop-blur-md sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black text-zinc-900 tracking-tighter font-headline uppercase">
          {viewTitles[currentView]}
        </h2>
        {currentView === 'research' && (
          <>
            <div className="h-4 w-px bg-zinc-300"></div>
            <div className="flex items-center text-xs font-semibold text-zinc-500 gap-1 uppercase tracking-widest">
              <span>Active Agent:</span>
              <span className="text-primary font-bold">Eagle-1 RA</span>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-6">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-1.5 bg-surface-container-low border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-primary-container outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/20">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-on-surface">Alex Mercer</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Chief Talent Officer</p>
            </div>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0Ufgd_xjOBOOwzRoKg7d81_katPpdTGEbeYSHApT7PGiQNzOx3QFxR9_xmAiOyufJMZ-rqd2al_BF1hP_qF5_6zhIiJVx9wAiwcOP2gMrC_xW2sbQ4GX0V5ZiFEXG_PGQp4FquldDP6wUXs6h_t5GPrTkbqyyL74-etv9WS1gB2yUhH7wVCnmFuRdpYokZETGV6PcEjP8Ips4vTDy5fQ0j0PyBBOZt-FwcO6ph63bZaMH3BhxMSaHz89YArNarVtbi7fYPBDPqjpc"
              alt="User profile"
              className="w-9 h-9 rounded-full object-cover border-2 border-primary/20"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
