import { Key, Settings as SettingsIcon, FolderOpen, FolderPlus, FileOutput, CheckCircle, Save, Eye } from 'lucide-react';

export function Settings() {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-12 gap-8 pb-24">
        {/* Intro Header Section */}
        <div className="col-span-12 mb-4">
          <h3 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Core Configuration</h3>
          <p className="text-secondary max-w-2xl">Manage your AI credentials and local environment synchronization. The Kinetic Elite operates with peak efficiency when your API infrastructure is properly mapped.</p>
        </div>

        {/* API Key Management Section */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-surface-container-lowest p-8 rounded-xl relative overflow-hidden group shadow-sm border border-outline-variant/10">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <div className="flex items-center gap-2 mb-6 text-primary">
              <Key className="w-5 h-5" />
              <h4 className="font-headline font-bold text-lg uppercase tracking-wider">API Key Management</h4>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-sans">OpenAI API Key</label>
                <div className="relative">
                  <input className="w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container transition-all py-3 px-4 outline-none rounded-lg font-mono text-sm" placeholder="sk-..." type="password" defaultValue="sk-••••••••••••••••••••••••••••" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-primary">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">Required for GPT-4 candidate analysis and summarization.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-sans">Anthropic Key</label>
                <div className="relative">
                  <input className="w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container transition-all py-3 px-4 outline-none rounded-lg font-mono text-sm" placeholder="sk-ant-..." type="password" defaultValue="sk-ant-••••••••••••••••••••••••" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-primary">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">Used for Claude-3 Opus high-context resume parsing.</p>
              </div>
            </div>
          </div>

          {/* System Configuration */}
          <div className="bg-surface-container-lowest p-8 rounded-xl relative overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <div className="flex items-center gap-2 mb-6 text-primary">
              <SettingsIcon className="w-5 h-5" />
              <h4 className="font-headline font-bold text-lg uppercase tracking-wider">System Configuration</h4>
            </div>
            <div className="flex items-end gap-6">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-sans">FastAPI Backend Port</label>
                <input className="w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container transition-all py-3 px-4 outline-none rounded-lg text-sm" type="number" defaultValue="8000" />
              </div>
              <div className="flex items-center gap-3 h-[50px] mb-[2px]">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Debug Mode</span>
                  <span className="text-[11px] text-zinc-400">Verbose logging</span>
                </div>
                <button className="w-12 h-6 rounded-full bg-primary-container relative p-1 transition-all">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Data Folders */}
        <section className="col-span-12 lg:col-span-5">
          <div className="bg-surface-container-lowest p-8 rounded-xl h-full border border-zinc-100 shadow-sm group">
            <div className="flex items-center gap-2 mb-6 text-primary">
              <FolderOpen className="w-5 h-5" />
              <h4 className="font-headline font-bold text-lg uppercase tracking-wider">Data Folders</h4>
            </div>
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 font-sans">Input Directory</label>
                <div className="group relative bg-surface-container-low p-4 rounded-lg border border-transparent hover:border-primary-container/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-600">/users/admin/documents/resumes_in</span>
                    <FolderPlus className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed italic">Source folder for raw PDF and DOCX files to be analyzed.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 font-sans">Output Directory</label>
                <div className="group relative bg-surface-container-low p-4 rounded-lg border border-transparent hover:border-primary-container/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-600">/users/admin/documents/scored_talent</span>
                    <FileOutput className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed italic">Destination for ranked CSVs and AI-generated candidate profiles.</p>
              </div>
              <div className="pt-6 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-zinc-700">Auto-Index on startup</span>
                  <button className="w-10 h-5 rounded-full bg-zinc-200 relative p-1 transition-all">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700">Cloud Sync (Beta)</span>
                  <button className="w-10 h-5 rounded-full bg-zinc-200 relative p-1 transition-all">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 right-0 left-64 bg-white/80 backdrop-blur-md px-8 py-6 border-t border-zinc-100 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 text-zinc-400">
          <CheckCircle className="w-5 h-5" />
          <span className="text-[11px] uppercase tracking-widest font-bold">Configuration valid and secure</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-6 py-2.5 text-zinc-600 font-bold tracking-tight text-sm hover:bg-zinc-100 transition-colors rounded-lg">
            Reset Defaults
          </button>
          <button className="kinetic-gradient px-10 py-2.5 text-white font-bold tracking-tight text-sm rounded-lg shadow-lg shadow-primary-container/20 scale-98-active duration-200 flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Changes
          </button>
        </div>
      </footer>
    </div>
  );
}
