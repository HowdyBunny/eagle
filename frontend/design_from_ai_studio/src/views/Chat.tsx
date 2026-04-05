import { Bot, Paperclip, Mic, Send, History, FileText } from 'lucide-react';

export function Chat() {
  return (
    <section className="flex-1 overflow-y-auto p-8 relative flex flex-col gap-8 h-full bg-surface-container-low">
      <div className="flex justify-center">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Today • 14:02 PM</span>
      </div>

      {/* Agent Message */}
      <div className="flex items-start gap-4 max-w-2xl">
        <div className="w-10 h-10 flex-shrink-0 kinetic-gradient rounded-full flex items-center justify-center shadow-lg">
          <Bot className="text-white w-5 h-5" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="bg-surface-container-lowest p-6 rounded-tr-3xl rounded-br-3xl rounded-bl-lg shadow-sm border-l-4 border-primary">
            <p className="text-on-surface leading-relaxed font-body">
              Good morning. I've analyzed the <span className="font-bold text-primary">Senior Architecture</span> candidates for the London project. There are three profiles that hit 98% match on your kinetic criteria. Would you like to dive into the Match-Strength Gauge for each, or should I start the initial reach-out sequence?
            </p>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium px-1">COORDINATOR AGENT • JUST NOW</span>
        </div>
      </div>

      {/* User Message */}
      <div className="flex items-start gap-4 max-w-2xl self-end flex-row-reverse">
        <div className="w-10 h-10 flex-shrink-0 bg-on-surface rounded-full flex items-center justify-center overflow-hidden shadow-md">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8RTKc67KCNl6_XcR4WuwTe9D4suyuQMYwmm7sMfocZ8Tms6hxIrtnMeqkgf82Lvmthhe0vNB2eMd18HeZXdabYdUkGhpDjJKrvNdliTiNYeEqAO2k-s9CdEitd_JkpL12kWcLaNmysb8MVbvKges7bDKe7tneelbTpO4yILd7Id4zHZuNsCcg8yCFCzoYE22x3K0VCKcd-EqZia66_Isq-bcqkt9cYGnolPwL-uXSfHseJu3ZmTxMinNNNJNb5YBwelsbSbmKGQiH" alt="User" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="bg-primary text-white p-6 rounded-tl-3xl rounded-bl-3xl rounded-br-lg shadow-md kinetic-gradient">
            <p className="leading-relaxed font-body">
              Let's see the Match-Strength Gauge first. I need to ensure they have high-precision leadership traits before we move to outreach. Also, cross-reference their industry research with current market trends.
            </p>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium px-1">YOU • 1 MIN AGO</span>
        </div>
      </div>

      {/* Agent Message (Analysis State) */}
      <div className="flex items-start gap-4 max-w-3xl">
        <div className="w-10 h-10 flex-shrink-0 kinetic-gradient rounded-full flex items-center justify-center shadow-lg">
          <Bot className="text-white w-5 h-5" />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="bg-surface-container-lowest p-6 rounded-tr-3xl rounded-br-3xl rounded-bl-lg shadow-sm border-l-4 border-primary space-y-4">
            <p className="text-on-surface font-body italic text-sm text-zinc-500">Cross-referencing database with Industry Research v4.2...</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-4 rounded-lg flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-zinc-200" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
                    <circle className="text-primary" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeDasharray="175" strokeDashoffset="35" strokeWidth="4"></circle>
                  </svg>
                  <span className="absolute text-xs font-bold font-headline">98%</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Candidate Alpha</p>
                  <p className="text-sm font-bold font-headline">Precision Leadership</p>
                </div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-lg flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-zinc-200" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
                    <circle className="text-primary" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeDasharray="175" strokeDashoffset="10" strokeWidth="4"></circle>
                  </svg>
                  <span className="absolute text-xs font-bold font-headline">92%</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Candidate Beta</p>
                  <p className="text-sm font-bold font-headline">Systemic Speed</p>
                </div>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium px-1">COORDINATOR AGENT • ANALYZING</span>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Message Input */}
      <footer className="sticky bottom-0 bg-surface-container-low pt-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-surface-container-lowest rounded-xl shadow-xl p-2 flex items-end gap-2 border border-outline-variant/15 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <button className="p-3 text-zinc-400 hover:text-primary transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea 
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 font-body text-on-surface placeholder:text-zinc-400 leading-relaxed outline-none" 
              placeholder="Instruct your Agent..." 
              rows={1}
            ></textarea>
            <button className="p-3 text-zinc-400 hover:text-primary transition-colors">
              <Mic className="w-5 h-5" />
            </button>
            <button className="kinetic-gradient text-white w-12 h-12 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 flex justify-center gap-6 pb-4">
            <button className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Recall Last Project
            </button>
            <button className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Generate Report
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
