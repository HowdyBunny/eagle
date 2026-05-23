import { useEffect, useState } from 'react'
import { Users, Search, Filter, X, Trash2, UserPlus, Sparkles, Loader2, Bookmark } from 'lucide-react'
import { useCandidateStore } from '@/stores/candidate-store'
import { useDebounce } from '@/hooks/use-debounce'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import StatusBadge from '@/components/shared/StatusBadge'
import CandidateDetailSheet from './CandidateDetailSheet'
import AddCandidateDialog from './AddCandidateDialog'
import SaveSearchDialog from '@/components/talent-lists/SaveSearchDialog'
import type { CandidateResponse, QueryRewriteResponse, TalentListFiltersJson } from '@/types'

// Chip rendered below the search box for each filter the LLM extracted.
// Each chip is clickable-to-remove so the recruiter stays in control of
// what got auto-applied.
interface RewriteChip {
  label: string
  bucket: 'filters' | 'exclusions'
  key: string
  value?: string
}

function chipsFromRewrite(r: QueryRewriteResponse | null): RewriteChip[] {
  if (!r) return []
  const chips: RewriteChip[] = []
  const f = r.filters
  if (f.location) chips.push({ label: `📍 ${f.location}`, bucket: 'filters', key: 'location' })
  if (f.min_years_experience != null)
    chips.push({ label: `≥ ${f.min_years_experience}年`, bucket: 'filters', key: 'min_years_experience' })
  if (f.max_years_experience != null)
    chips.push({ label: `≤ ${f.max_years_experience}年`, bucket: 'filters', key: 'max_years_experience' })
  if (f.current_company) chips.push({ label: `🏢 ${f.current_company}`, bucket: 'filters', key: 'current_company' })
  for (const s of f.schools) chips.push({ label: `🎓 ${s}`, bucket: 'filters', key: 'schools', value: s })
  const e = r.exclusions
  for (const c of e.exclude_companies)
    chips.push({ label: `❌ ${c}`, bucket: 'exclusions', key: 'exclude_companies', value: c })
  for (const l of e.exclude_locations)
    chips.push({ label: `❌ 📍 ${l}`, bucket: 'exclusions', key: 'exclude_locations', value: l })
  if (e.exclude_query) chips.push({ label: `❌ ${e.exclude_query}`, bucket: 'exclusions', key: 'exclude_query' })
  return chips
}

function computeCompleteness(c: CandidateResponse): number {
  let s = 0
  if (c.full_name) s += 20
  if (c.phone || c.email) s += 20
  if (c.current_title) s += 10
  if (c.current_company) s += 10
  if (c.years_experience != null) s += 10
  if (c.experience_summary) s += 15
  if (c.education) s += 10
  if (c.location) s += 5
  return s
}

export default function TalentPoolView() {
  const {
    candidates, searchResults, isSearchMode, loading,
    fetchCandidates, searchCandidates, rerunSearchWithCurrentRewrite,
    deleteCandidate, setFilters, setPage, clearSearch,
    filters, skip, limit,
    smartSearch, setSmartSearch, rewriteResult, rewriteLoading, removeRewriteFilter,
  } = useCandidateStore()

  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 400)

  // Snapshot of what produced the currently-visible result set, so the
  // SaveSearchDialog can persist exactly what the recruiter sees on screen.
  const filtersSnapshot: TalentListFiltersJson = {
    query: debouncedQuery.trim() || null,
    location: filters.location || null,
    min_years_experience: filters.minYears ?? null,
    max_years_experience: filters.maxYears ?? null,
    current_company: filters.company || null,
    schools: rewriteResult?.filters.schools?.length ? rewriteResult.filters.schools : null,
    exclude_companies: rewriteResult?.exclusions.exclude_companies?.length
      ? rewriteResult.exclusions.exclude_companies
      : null,
    exclude_locations: rewriteResult?.exclusions.exclude_locations?.length
      ? rewriteResult.exclusions.exclude_locations
      : null,
    exclude_query: rewriteResult?.exclusions.exclude_query ?? null,
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPendingDeleteId(id)
  }

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null)
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

  // Re-run the active query whenever filters change in search mode.
  // Without this, changing a filter while a query is active silently dropped you
  // back into the unfiltered list view.
  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchCandidates(debouncedQuery.trim())
    }
  }, [filters, debouncedQuery, searchCandidates])

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={displayedCandidates.length === 0}
            title={
              displayedCandidates.length === 0
                ? '当前没有可保存的候选人'
                : '将当前命中的候选人保存到名单'
            }
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/25 text-primary text-sm font-headline font-semibold hover:bg-primary/5 transition-all scale-98-active disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Bookmark size={15} />
            保存搜索
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active"
          >
            <UserPlus size={15} />
            手动添加候选人
          </button>
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
            {rewriteLoading ? (
              <Loader2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary animate-spin" />
            ) : (
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/60" />
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                rewriteLoading
                  ? '正在理解查询...'
                  : smartSearch
                  ? '语义搜索 · 智能模式（复杂查询会调用 LLM 解析）'
                  : '关键词搜索 · 搜索名字、电话、邮箱、公司等'
              }
              className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-secondary/50 outline-none focus:border-primary/30 transition-colors shadow-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setSmartSearch(!smartSearch)}
            title={smartSearch ? '点击关闭：纯关键词搜索，零 token 消耗' : '点击启用：复杂查询会调用 LLM 拆解（消耗少量 token）'}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              smartSearch
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-surface-container-lowest border-outline-variant/10 text-secondary hover:text-on-surface'
            }`}
          >
            <Sparkles size={14} /> 智能
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-surface-container-lowest border-outline-variant/10 text-secondary hover:text-on-surface'
            }`}
          >
            <Filter size={14} /> 筛选
          </button>
        </div>

        {/* LLM-extracted filter chips. Visible only when a rewrite actually
            spent an LLM call and produced something. Click the × to remove
            a single chip — the search re-runs without that constraint. */}
        {rewriteResult?.used_llm && chipsFromRewrite(rewriteResult).length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary mr-1">
              智能解析
            </span>
            {chipsFromRewrite(rewriteResult).map((chip, i) => (
              <button
                key={`${chip.bucket}-${chip.key}-${chip.value ?? ''}-${i}`}
                onClick={() => {
                  removeRewriteFilter(chip.bucket, chip.key, chip.value)
                  // Re-run the search using the *edited* rewriteResult, skipping
                  // a fresh LLM call. Otherwise removing a chip would just be
                  // immediately overwritten by another rewrite returning the
                  // same chips for the same query.
                  if (debouncedQuery.trim()) rerunSearchWithCurrentRewrite(debouncedQuery.trim())
                }}
                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant/20 text-xs text-on-surface hover:border-red-300 transition-colors"
              >
                <span>{chip.label}</span>
                <X size={10} className="text-secondary group-hover:text-red-500" />
              </button>
            ))}
          </div>
        )}

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
                    // In search mode the useEffect above re-runs the search; otherwise refresh the list.
                    if (!debouncedQuery.trim()) fetchCandidates()
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
          {rewriteResult?.used_llm && (
            <span className="text-[10px] font-bold text-primary/70">
              · 已调用 LLM 解析查询
            </span>
          )}
          {smartSearch && rewriteResult && !rewriteResult.used_llm && (
            <span className="text-[10px] text-secondary/70">
              · 简单查询，未调用 LLM
            </span>
          )}
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
          {/* table-fixed + explicit col widths so the "确认删除？" inline
              confirm and other per-row state changes don't reflow the
              whole table. */}
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[18%]" />{/* 候选人 */}
              <col className="w-[20%]" />{/* 职位/公司 */}
              <col className="w-[8%]" />{/* 经验 */}
              <col className="w-[14%]" />{/* 地点 */}
              <col className="w-[14%]" />{/* 时效/完整 */}
              <col className="w-[10%]" />{/* 来源 */}
              <col className="w-[16%]" />{/* 操作 */}
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                {['候选人', '职位 / 公司', '经验', '地点', '时效 / 完整', '来源', '操作'].map((h) => (
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
                  {/* 时效 + 完整度 */}
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1 rounded-full bg-surface-container shrink-0">
                          <div
                            className={`h-full rounded-full ${(c.confidence_score ?? 0) >= 60 ? 'bg-primary' : 'bg-red-400'}`}
                            style={{ width: `${Math.max(0, Math.min(100, c.confidence_score ?? 0))}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ${(c.confidence_score ?? 0) < 60 ? 'text-red-500' : 'text-secondary'}`}>
                          {Math.round(c.confidence_score ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1 rounded-full bg-surface-container shrink-0">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${computeCompleteness(c)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-secondary">
                          {computeCompleteness(c)}
                        </span>
                      </div>
                    </div>
                  </td>
                  {/* Source */}
                  <td className="px-4 py-3">
                    <StatusBadge status={c.source_platform ?? 'unknown'} variant="candidate" />
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    {pendingDeleteId === c.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-secondary">确认删除？</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); confirmDelete(c.id) }}
                          className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors"
                        >
                          确认
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteId(null) }}
                          className="text-[11px] text-secondary hover:text-on-surface transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedCandidate(c)}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          查看档案
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, c.id)}
                          disabled={deletingId === c.id}
                          className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
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

      <AddCandidateDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />

      <SaveSearchDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        candidates={displayedCandidates}
        query={debouncedQuery}
        filtersJson={filtersSnapshot}
      />
    </div>
  )
}
