import { useEffect, useState } from 'react'
import { Users, Search, Filter, X, Trash2 } from 'lucide-react'
import { useCandidateStore } from '@/stores/candidate-store'
import { useDebounce } from '@/hooks/use-debounce'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import StatusBadge from '@/components/shared/StatusBadge'
import CandidateDetailSheet from './CandidateDetailSheet'
import type { CandidateResponse } from '@/types'

export default function TalentPoolView() {
  const {
    candidates, searchResults, isSearchMode, loading,
    fetchCandidates, searchCandidates, deleteCandidate, setFilters, setPage, clearSearch,
    filters, skip, limit,
  } = useCandidateStore()

  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 400)

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('确认从人才库中删除此候选人？')) return
    setDeletingId(id)
    try {
      await deleteCandidate(id)
      if (selectedCandidate?.id === id) setSelectedCandidate(null)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => { fetchCandidates() }, [fetchCandidates])

  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchCandidates(debouncedQuery.trim())
    } else {
      clearSearch()
    }
  }, [debouncedQuery, searchCandidates, clearSearch])

  const displayedCandidates = isSearchMode
    ? searchResults.map((r) => r.candidate)
    : candidates

  const stats = {
    total: candidates.length,
    linkedin: candidates.filter((c) => c.source_platform === 'linkedin').length,
    highConfidence: candidates.filter((c) => (c.confidence_score ?? 0) >= 80).length,
  }

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline font-black text-2xl tracking-tight text-on-surface">人才库</h2>
          <p className="text-sm text-secondary mt-0.5">所有候选人的全局人才池</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '总候选人数', value: stats.total },
          { label: 'LinkedIn 来源', value: stats.linkedin },
          { label: '高置信度', value: stats.highConfidence },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm p-5 border-l-4 border-l-primary">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">{label}</p>
            <p className="font-headline font-black text-4xl tracking-tighter text-on-surface">{value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="语义搜索候选人（技能、经历、行业...）"
              className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-secondary/50 outline-none focus:border-primary/30 transition-colors shadow-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-surface-container-lowest border-outline-variant/10 text-secondary hover:text-on-surface'
            }`}
          >
            <Filter size={14} /> 筛选
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="grid grid-cols-4 gap-3 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
            {[
              { label: '地点', key: 'location', placeholder: '新加坡', type: 'text' },
              { label: '最少年限', key: 'minYears', placeholder: '5', type: 'number' },
              { label: '最多年限', key: 'maxYears', placeholder: '15', type: 'number' },
              { label: '公司名称', key: 'company', placeholder: '某科技公司', type: 'text' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={String(filters[key as keyof typeof filters] ?? '')}
                  onChange={(e) => {
                    const val = type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value
                    setFilters({ [key]: val } as Parameters<typeof setFilters>[0])
                    fetchCandidates()
                  }}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface outline-none border border-transparent focus:border-primary/20 transition-colors"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search mode badge */}
      {isSearchMode && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            语义搜索结果 · {searchResults.length} 条
          </span>
          <button onClick={() => { setQuery(''); clearSearch() }} className="text-[10px] text-secondary hover:text-on-surface underline">
            清除搜索
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : displayedCandidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="暂无候选人"
          description="使用 Chrome 插件在 LinkedIn 或猎聘上收录候选人，数据将自动入库"
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                {['候选人', '职位 / 公司', '经验', '地点', '置信度', '来源', '操作'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {displayedCandidates.map((c) => (
                <tr key={c.id} className="group hover:bg-surface-container-low transition-colors">
                  {/* Name + avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full kinetic-gradient flex items-center justify-center text-white font-headline font-black text-xs shrink-0">
                        {c.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{c.full_name}</p>
                        <p className="text-[11px] text-secondary">{new Date(c.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </div>
                  </td>
                  {/* Title / Company */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-on-surface">{c.current_title ?? '—'}</p>
                    <p className="text-[11px] text-secondary">{c.current_company ?? '—'}</p>
                  </td>
                  {/* Years */}
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                      {c.years_experience != null ? `${c.years_experience}年` : '—'}
                    </span>
                  </td>
                  {/* Location */}
                  <td className="px-4 py-3 text-sm text-secondary">{c.location ?? '—'}</td>
                  {/* Confidence */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-surface-container">
                        <div
                          className={`h-full rounded-full ${(c.confidence_score ?? 0) >= 60 ? 'bg-primary' : 'bg-red-400'}`}
                          style={{ width: `${Math.max(0, Math.min(100, c.confidence_score ?? 0))}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold ${(c.confidence_score ?? 0) < 60 ? 'text-red-500' : 'text-secondary'}`}>
                        {Math.round(c.confidence_score ?? 0)}
                      </span>
                    </div>
                  </td>
                  {/* Source */}
                  <td className="px-4 py-3">
                    <StatusBadge status={c.source_platform ?? 'unknown'} variant="candidate" />
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        查看档案
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, c.id)}
                        disabled={deletingId === c.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {!isSearchMode && (
            <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-[11px] text-secondary">
                显示 {skip + 1}–{Math.min(skip + limit, candidates.length + skip)} 条
              </p>
              <div className="flex gap-1">
                <button
                  disabled={skip === 0}
                  onClick={() => { setPage(Math.max(0, skip - limit)); fetchCandidates() }}
                  className="px-3 py-1 rounded text-[11px] font-bold text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors"
                >
                  上一页
                </button>
                <button
                  disabled={candidates.length < limit}
                  onClick={() => { setPage(skip + limit); fetchCandidates() }}
                  className="px-3 py-1 rounded text-[11px] font-bold text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={selectedCandidate != null}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  )
}
