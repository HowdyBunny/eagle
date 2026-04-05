import { BookOpen, Share, Download, Folder, CheckCircle, TrendingUp } from 'lucide-react';

export function Research() {
  return (
    <div className="flex h-full overflow-hidden bg-surface-container-low">
      {/* Left Panel: Recent Reports */}
      <section className="w-80 flex flex-col border-r border-zinc-200/50 bg-white/40 shrink-0">
        <div className="p-6 border-b border-zinc-200/50">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Latest Insights</h3>
          <div className="space-y-4">
            {/* Active Report Item */}
            <div className="p-4 bg-white rounded-lg shadow-sm border-l-4 border-primary cursor-pointer transition-all hover:translate-x-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">FinTech • May 2024</span>
              <h4 className="font-bold text-zinc-900 text-sm leading-tight mb-2">The 2024 AI Banking Revolution: Talent Displacement Trends</h4>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-[11px] text-zinc-500 font-medium">Ready for review</span>
              </div>
            </div>
            {/* Inactive Report Item */}
            <div className="p-4 bg-transparent hover:bg-zinc-100/80 rounded-lg cursor-pointer transition-all">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Energy • April 2024</span>
              <h4 className="font-bold text-zinc-700 text-sm leading-tight mb-2">Sustainable Infrastructure: Global Engineering Skill Gaps</h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">Published 2d ago</span>
              </div>
            </div>
            {/* Inactive Report Item */}
            <div className="p-4 bg-transparent hover:bg-zinc-100/80 rounded-lg cursor-pointer transition-all">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Biotech • March 2024</span>
              <h4 className="font-bold text-zinc-700 text-sm leading-tight mb-2">CRISPR Research Talent Migration: East to West Shift</h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">Published 1w ago</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Saved Collections</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between group cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-zinc-600">Fortune 500 Q2</span>
              </div>
              <span className="text-xs text-zinc-400">12</span>
            </div>
            <div className="flex items-center justify-between group cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-zinc-600">Crypto Regulatory</span>
              </div>
              <span className="text-xs text-zinc-400">08</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Panel: Document Viewer */}
      <section className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Toolbar */}
          <div className="flex justify-between items-center glass-overlay p-3 rounded-lg sticky top-0 z-20 border border-white/40 shadow-sm">
            <div className="flex items-center gap-4 text-sm text-zinc-600 font-medium ml-2">
              <div className="flex items-center gap-1">
                <BookOpen className="w-5 h-5" />
                <span>Reading Mode</span>
              </div>
              <div className="h-4 w-px bg-zinc-300"></div>
              <span>14 pages</span>
              <span>•</span>
              <span>12,400 words</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-zinc-700 hover:bg-zinc-100 rounded-md transition-all text-sm font-bold border border-zinc-200">
                <Share className="w-4 h-4" /> Export
              </button>
              <button className="flex items-center gap-2 px-5 py-2 kinetic-gradient text-white rounded-md transition-all text-sm font-bold shadow-md">
                <Download className="w-4 h-4" /> Download Report
              </button>
            </div>
          </div>

          {/* The Publication */}
          <article className="bg-surface-container-lowest shadow-2xl rounded-sm p-16 relative overflow-hidden">
            <header className="mb-12 border-b-2 border-primary-container pb-8 relative z-10">
              <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase mb-4">
                <CheckCircle className="w-4 h-4 fill-primary text-white" />
                Elite Intelligence Network Analysis
              </div>
              <h1 className="font-headline text-5xl font-extrabold text-on-background tracking-tighter leading-tight mb-4">
                The 2024 AI Banking Revolution:<br /><span className="text-zinc-400">Talent Displacement Trends</span>
              </h1>
              <div className="flex items-center gap-8 text-sm text-zinc-500 font-medium">
                <div>
                  <p className="uppercase text-[10px] tracking-widest font-black text-zinc-400 mb-1">PUBLICATION DATE</p>
                  <p className="text-zinc-900">May 14, 2024</p>
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-widest font-black text-zinc-400 mb-1">AUTHORING AGENT</p>
                  <p className="text-zinc-900">Eagle-1 (Neural Synthesis Unit)</p>
                </div>
                <div>
                  <p className="uppercase text-[10px] tracking-widest font-black text-zinc-400 mb-1">CLASSIFICATION</p>
                  <p className="text-zinc-900">Elite / Restricted</p>
                </div>
              </div>
            </header>

            <div className="prose prose-zinc max-w-none space-y-6 text-zinc-800 leading-relaxed font-body">
              <h2 className="font-headline text-2xl font-bold text-zinc-900 pt-4 flex items-center gap-3">
                01. Executive Summary
                <div className="h-px flex-1 bg-zinc-100"></div>
              </h2>
              <p className="text-lg leading-relaxed first-letter:text-5xl first-letter:font-black first-letter:text-primary first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                The financial services sector is witnessing its most aggressive technological pivot in three decades. As of Q2 2024, institutional banking has accelerated its transition from legacy manual auditing processes to AI-driven "Neural Compliance" ecosystems. This report analyzes the resulting talent shifts and identifies critical skill gaps in the workforce.
              </p>

              <h3 className="font-headline text-xl font-bold text-zinc-900 mt-10">Core Displacement Metrics</h3>
              <ul className="space-y-4 list-none pl-0">
                <li className="flex items-start gap-4 p-4 rounded-lg bg-surface-container-low border-l-4 border-primary-container">
                  <TrendingUp className="text-primary mt-1 w-5 h-5" />
                  <div>
                    <p className="font-bold text-zinc-900">Efficiency Surge</p>
                    <p className="text-sm text-zinc-600">Compliance turnaround times have decreased by 78% across Top 10 investment banks.</p>
                  </div>
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
