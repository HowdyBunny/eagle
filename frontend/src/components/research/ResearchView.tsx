import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Plus, ChevronRight, BookOpen } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useResearchStore } from '@/stores/research-store'
import TriggerResearchDialog from './TriggerResearchDialog'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import type { OntologyResponse } from '@/types'

function OntologyDoc({ ontology }: { ontology: OntologyResponse }) {
  return (
    <article className="bg-surface-container-lowest shadow-2xl rounded-2xl p-12 max-w-3xl mx-auto">
      {/* Drop-cap style header */}
      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-6">{ontology.industry}</p>
      <h1 className="font-headline font-black text-3xl tracking-tight text-on-surface mb-8 leading-tight">
        <span className="text-5xl font-black text-primary float-left mr-3 mt-1 leading-none">
          {ontology.concept.charAt(0)}
        </span>
        {ontology.concept.slice(1)}
      </h1>

      {ontology.synonyms && ontology.synonyms.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">同义词 / 别称</h2>
          <div className="flex flex-wrap gap-2">
            {ontology.synonyms.map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">{s}</span>
            ))}
          </div>
        </section>
      )}

      {ontology.tech_stack && ontology.tech_stack.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">技术栈</h2>
          <div className="flex flex-wrap gap-2">
            {ontology.tech_stack.map((t) => (
              <span key={t} className="px-3 py-1 rounded bg-surface-container-low text-on-surface text-sm font-mono">{t}</span>
            ))}
          </div>
        </section>
      )}

      {ontology.prerequisites && ontology.prerequisites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">前置技能</h2>
          <ul className="space-y-1.5">
            {ontology.prerequisites.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-on-surface">
                <ChevronRight size={13} className="text-primary shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ontology.key_positions && ontology.key_positions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">关键岗位</h2>
          <div className="flex flex-wrap gap-2">
            {ontology.key_positions.map((k) => (
              <span key={k} className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-sm">{k}</span>
            ))}
          </div>
        </section>
      )}

      {ontology.skill_relations && Object.keys(ontology.skill_relations).length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-4">技能关联图</h2>
          <div className="space-y-4">
            {Object.entries(ontology.skill_relations).map(([domain, skills]) => (
              <div key={domain} className="border-l-4 border-primary pl-4">
                <p className="text-sm font-bold text-on-surface mb-2">{domain}</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-surface-container text-secondary text-xs font-mono">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ontology.jargon && Object.keys(ontology.jargon).length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">行业黑话词典</h2>
          <div className="space-y-2">
            {Object.entries(ontology.jargon).map(([term, meaning]) => (
              <div key={term} className="flex gap-3 text-sm">
                <span className="font-bold text-on-surface min-w-28 shrink-0">{term}</span>
                <span className="text-secondary">{meaning}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-secondary/60 mt-10">
        生成时间：{new Date(ontology.created_at).toLocaleDateString('zh-CN')}
      </p>
    </article>
  )
}

export default function ResearchView() {
  const { currentProjectId, currentProject } = useAppStore()
  const { records, selectedRecordId, loading, fetchRecords, selectRecord } = useResearchStore()
  const [showDialog, setShowDialog] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (currentProjectId) fetchRecords(currentProjectId)
  }, [currentProjectId, fetchRecords])

  const selectedRecord = records.find((r) => r.id === selectedRecordId) ?? records[0] ?? null

  if (!currentProjectId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <BarChart2 size={40} className="text-secondary/40" />
        <p className="font-headline font-bold text-lg text-on-surface">请先选择一个项目</p>
        <button onClick={() => navigate('/projects')} className="px-5 py-2 rounded-xl kinetic-gradient text-white text-sm font-semibold">
          前往项目管理
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 shrink-0 border-r border-outline-variant/10 bg-white/40 flex flex-col">
        <div className="p-4 border-b border-outline-variant/10">
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-0.5">当前项目</p>
          <p className="text-sm font-bold text-on-surface">{currentProject?.project_name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary">行业报告</p>
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-70 transition-opacity"
            >
              <Plus size={12} />触发调研
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-secondary mb-3">暂无调研报告</p>
              <button
                onClick={() => setShowDialog(true)}
                className="text-sm text-primary hover:underline font-medium"
              >
                触发第一次调研
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {records.map((r) => {
                const isActive = (selectedRecordId ?? records[0]?.id) === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRecord(r.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white shadow-sm border-l-4 border-primary'
                        : 'hover:bg-white/60 border-l-4 border-transparent'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
                      {r.ontology?.industry ?? '行业'}
                    </p>
                    <p className="text-sm font-semibold text-on-surface line-clamp-2">
                      {r.ontology?.concept ?? '调研报告'}
                    </p>
                    <p className="text-[10px] text-secondary mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right document viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 glass-overlay border-b border-outline-variant/10 px-6 py-3 flex items-center gap-3">
          <BookOpen size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
            {selectedRecord?.ontology?.industry ?? '行业研究'} · Eagle Research Agent
          </span>
        </div>

        {/* Document content */}
        <div className="flex-1 overflow-y-auto px-8 py-10 bg-surface">
          {selectedRecord?.ontology ? (
            <OntologyDoc ontology={selectedRecord.ontology} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <BarChart2 size={48} className="text-secondary/30" />
              <p className="font-headline font-bold text-lg text-secondary">选择左侧报告查看详情</p>
              <p className="text-sm text-secondary/60">或点击「触发调研」让 Research Agent 开始分析</p>
            </div>
          )}
        </div>
      </div>

      <TriggerResearchDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        projectId={currentProjectId}
      />
    </div>
  )
}
