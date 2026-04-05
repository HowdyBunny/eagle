import { PlusCircle, TrendingUp, MoreVertical } from 'lucide-react';

export function Projects() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-outline-variant/15 pb-8">
        <div className="space-y-2">
          <p className="text-primary font-bold text-xs uppercase tracking-[0.2em] mb-2">Operational Overview</p>
          <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface leading-none font-headline">Precision Pipeline</h2>
          <p className="text-secondary text-lg max-w-md">Manage your elite candidate searches and AI-driven talent acquisition streams.</p>
        </div>
        <button className="kinetic-gradient text-white px-8 py-4 rounded font-bold flex items-center gap-3 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl">
          <PlusCircle className="w-5 h-5" /> NEW PROJECT
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-xl border-l-4 border-primary shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Active Hunt Performance</span>
            <TrendingUp className="text-primary w-5 h-5" />
          </div>
          <div className="mt-4">
            <span className="text-5xl font-black tracking-tighter text-on-surface">14</span>
            <span className="text-secondary ml-2 font-medium">Global Projects</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">Top Match Rate</span>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tighter text-on-surface">92%</span>
            <div className="w-full bg-zinc-200 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[92%]"></div>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">Avg. Time to Shortlist</span>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tighter text-on-surface">3.4d</span>
            <p className="text-[10px] text-primary font-bold mt-1 uppercase">Top 1% Efficiency</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Project Card 1 */}
        <div className="group relative bg-surface-container-lowest p-0 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-outline-variant/10">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary rounded">Evaluating</span>
              <button className="text-zinc-400 hover:text-primary transition-colors"><MoreVertical className="w-5 h-5" /></button>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-on-surface mb-1">Senior React Developer</h3>
            <p className="text-secondary text-sm font-medium mb-6">TechCorp Industries • London, UK</p>
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white ring-2 ring-primary/20">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDP75KvCdmx9GKYguQB7GoEQ8DUixnBnBk_Ias5V6IPuxT5-o3PTvFFFotgQQK_7HBOEYEZSp71NtzIFQYmLdfEWNmzY0Zxi9T1axZTs4BxbmmpNVx5K3G9E8qMZM6f7knm7EhEm6--uO6o0o4Um0G6qvn3dSGfWamzg1R6yZHAH13QNcPCV3fo5FZtsdJWyemxtkFiZhUdk8AmTMU6irXcGNgwypMgeCt7FSJ4lazs_URqxjatjRywl1JH2l90OHEy6G3FjNZP3hFG" alt="Agent" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-tighter">Assigned Agent</p>
                <p className="text-sm font-bold text-on-surface">Agent Aurelius</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-6 border-t border-zinc-50">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold">JD</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold">MK</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center text-[10px] font-bold">+12</div>
              </div>
              <button className="bg-zinc-900 text-white px-5 py-2 text-xs font-bold rounded tracking-tight transition-transform active:scale-95">Select Project</button>
            </div>
          </div>
        </div>

        {/* Project Card 2 */}
        <div className="group relative bg-surface-container-lowest p-0 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-outline-variant/10">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-500 rounded">Searching</span>
              <button className="text-zinc-400 hover:text-primary transition-colors"><MoreVertical className="w-5 h-5" /></button>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-on-surface mb-1">Head of Marketing</h3>
            <p className="text-secondary text-sm font-medium mb-6">GlobalBrand Retail • Remote</p>
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white ring-2 ring-primary/20">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAD907_PdeDIxAfjjLO0esbSQUl-w-PVkLJC3_yqSAu3LDnNA2lJBtc5B4nRmj0n-ZXVszO-3KaCB16MSii2X-1TnPw4xDtMlTb_zbfWbZZl5uQU7ynO3LjzAmc7WPQ95tMHn_eOQAZ3sj88vc-DPnNDZJyHZVuOYGjJIIrC3Mbml-p9pAzzvG2bQLoZDa5JaTW451aNtMVtHYG3WesoR6ad1JIrCHy4A-mtZH2AoSruCr_fAAX2ptlv01g-zaXsdJ2ieYfxXXnsSEJ" alt="Agent" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-tighter">Assigned Agent</p>
                <p className="text-sm font-bold text-on-surface">Agent Hera</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-6 border-t border-zinc-50">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold">AL</div>
                <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center text-[10px] font-bold">+4</div>
              </div>
              <button className="bg-zinc-900 text-white px-5 py-2 text-xs font-bold rounded tracking-tight transition-transform active:scale-95">Select Project</button>
            </div>
          </div>
        </div>

        {/* Project Card 3 */}
        <div className="group relative md:col-span-2 lg:col-span-1 bg-surface-container-low p-0 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-outline-variant/5">
          <div className="p-8 flex flex-col gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-primary text-white rounded">Priority Dive</span>
                <span className="text-xs text-primary font-bold">Closes in 48h</span>
              </div>
              <h3 className="text-2xl font-black tracking-tighter text-on-surface mb-2">Director of Engineering</h3>
              <p className="text-secondary font-medium mb-6">QuantumLeap Solutions • San Francisco</p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-[9px] uppercase font-black text-zinc-400">Total Applicants</p>
                  <p className="text-lg font-black text-on-surface">1,248</p>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-[9px] uppercase font-black text-zinc-400">AI Shortlist</p>
                  <p className="text-lg font-black text-primary">12 Elite</p>
                </div>
              </div>
              <button className="kinetic-gradient text-white px-8 py-3 text-sm font-black rounded-lg shadow-lg w-full">Review Elite Shortlist</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
