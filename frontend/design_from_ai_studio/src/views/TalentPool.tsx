import { Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const candidates = [
  {
    name: 'Marcus Thorne',
    email: 'marcus.t@elite-rec.com',
    role: 'Cloud Infrastructure Lead',
    skills: 'AWS / Kubernetes / FinOps',
    exp: '12+ Yrs',
    status: 'Interviewing',
    statusColor: 'bg-primary',
    date: 'Oct 12, 2023',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLSOSThQTHnV_qrOo0XsU3_eEzY8Fh6BbPs89cg8bNfifxZbErgtZ1eYjpyPDUCFl6g2Ryj7t81ODHujSM0YZZmpeJFw2CgX030QcPWJPERbnyJo0y_1TPdS0-K43lTThYd4hCcNnxuhJLKPpDQQSQyJBzwpobJHMOsc1co1PBxIoG6gex088U-lWgFSZEorJ8Zt4HpjXuolnrQP61394T5ODSdNza7zPK21UzbvWEIHiS5NiSgLL7ZMGNRQvxw48PQOEwmdJfwMhG'
  },
  {
    name: 'Sienna Zhang',
    email: 's.zhang@ux-maverick.ai',
    role: 'Sr. Product Designer',
    skills: 'Strategy / Motion / Design Systems',
    exp: '8 Yrs',
    status: 'On Hold',
    statusColor: 'bg-zinc-400',
    date: 'Nov 04, 2023',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmuVXxOX_hL1N2nX_pIwVK1c5BjhGErJcd02NzChj36azZVRj_oksYb2Xa9TJ4DIUpXTlALcmUifL1DaavZRrXcD9UNY-ZHZcC75AyadUfvYaWsmeV7DWwArOXJCqPlaV3U0CDBxDzH6b04IFUzuSMheG3-R75dmEMIGZVtPg69x-IXopEINGGcQFb9YhrCqsmCWdJOZz5zPul9vTMP12UNfsGznZbepp9VgOkN14F50zoAFyuBfZhXXuuGZ5mAyd9kcUNpBmFC2mA'
  },
  {
    name: 'Julian Vance',
    email: 'julian.v@tech-summit.org',
    role: 'Director of Engineering',
    skills: 'Scale / Leadership / Python / Go',
    exp: '15+ Yrs',
    status: 'Available',
    statusColor: 'bg-green-500',
    date: 'Dec 01, 2023',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBM9g3bCwW9z09wh6m8O0QatNEM6St0wlKSoGbup1GPWXJf0Q3LyOVgtbkzoojsxD6iZZcp47MQfjbBbfv3RQ9NW0BxN3QdLWH8baLMg1tzKSKnyw8qcnHyCe6cYNXnVzuChZD80wLQPi_hKQ-o01PA-Wan35WSuZ0TEJJB083ewd9g2V_oYOSKpC4uDhUA5WSzdpDfOcwDibJMnIyCyxh5j6hhisIeF0zO73Wixprd-FwRF-OOiCO-t8N-OnmG4AWDuEScnqx1ZAWl'
  },
  {
    name: 'Elena Rodriguez',
    email: 'e.rodriguez@ml-elite.io',
    role: 'Principal AI Researcher',
    skills: 'NLP / LLMs / PyTorch / Transformers',
    exp: '10 Yrs',
    status: 'Offer Out',
    statusColor: 'bg-primary',
    date: 'Dec 15, 2023',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCh_jHdXFfUeoXi_6z_6lLeI1kibOOjHH-UT_-laC5Fj32db02_iJJ1vWBRN1VtSaieKqGkTA1Q4l0fpC3sPduzI_6JDxaraet_fkbVZaM4VkAuB0IgCld40L9gCgcwSSSqt1KdMOFLmOtueWLuVcSxSVzQinhw7hrJ0v_8yx9xSeZimk8D2PH-_4qLaXnRejP9VLYuOEcS3su3u5m-KlxKV04pH4O4g5fjxWBqSE8Ncmm7Lg4L7dgW3FE31C8xb8t1zGRfKkDu_0RJ'
  }
];

export function TalentPool() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-6 border-l-4 border-primary shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Candidates</p>
          <h3 className="text-3xl font-black text-on-surface tracking-tighter">12,482</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 border-l-4 border-primary/30 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Searches</p>
          <h3 className="text-3xl font-black text-on-surface tracking-tighter">48</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 border-l-4 border-primary/30 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Hired This Month</p>
          <h3 className="text-3xl font-black text-on-surface tracking-tighter">156</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 border-l-4 border-primary/30 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Top Matches</p>
          <h3 className="text-3xl font-black text-on-surface tracking-tighter">92%</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button className="bg-surface-container-high px-4 py-2 text-xs font-bold uppercase tracking-widest rounded">All Talents</button>
          <button className="bg-surface-container-low px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-on-surface transition-colors rounded">Verified Only</button>
          <button className="bg-surface-container-low px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-on-surface transition-colors rounded">Top 1% AI Picks</button>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-primary transition-colors">
            <Filter className="w-4 h-4" /> Advanced Filter
          </button>
          <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-primary transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest overflow-hidden shadow-sm rounded-lg border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Candidate Name</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Role / Discipline</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 text-center">Exp. Level</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Current Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">Date Added</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {candidates.map((c, i) => (
                <tr key={i} className="hover:bg-surface-container-low group transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={c.img} alt={c.name} className="w-10 h-10 rounded object-cover" />
                        <div className={`absolute -top-1 -right-1 w-3 h-3 ${c.statusColor} border-2 border-white rounded-full`}></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface leading-tight">{c.name}</p>
                        <p className="text-[10px] text-zinc-400">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">{c.role}</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-tighter">{c.skills}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-black uppercase">{c.exp}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                      <span className={`w-1.5 h-1.5 ${c.statusColor} rounded-full`}></span>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-zinc-500">{c.date}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-primary/20 hover:bg-primary-container hover:text-on-primary-container transition-all rounded">View Profile</button>
                      <button className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-primary-container text-on-primary-container hover:brightness-110 transition-all rounded">Add to Project</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 flex items-center justify-between bg-surface-container-low border-t border-outline-variant/10">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Showing 1-4 of 12,482 Talent Assets</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded bg-primary text-white text-[10px] font-black">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-[10px] font-bold">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-[10px] font-bold">3</button>
            <span className="px-1 text-zinc-400">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-[10px] font-bold">1,248</button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
