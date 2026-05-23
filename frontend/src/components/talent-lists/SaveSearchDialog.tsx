import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { useProjectStore } from '@/stores/project-store'
import { useTalentListStore } from '@/stores/talent-list-store'
import type {
  CandidateResponse,
  TalentListFiltersJson,
  TalentListSummaryResponse,
} from '@/types'

interface SaveSearchDialogProps {
  open: boolean
  onClose: () => void
  /** All candidates currently visible in the search/filter result. */
  candidates: CandidateResponse[]
  /** Optional human-readable search query string for the auto-suggested name. */
  query?: string
  /** Filter snapshot to persist alongside the list. */
  filtersJson: TalentListFiltersJson
}

export default function SaveSearchDialog({
  open,
  onClose,
  candidates,
  query,
  filtersJson,
}: SaveSearchDialogProps) {
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const currentProject = useAppStore((s) => s.currentProject)
  const projects = useProjectStore((s) => s.projects)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)
  const createList = useTalentListStore((s) => s.createList)
  const updateMembers = useTalentListStore((s) => s.addMembers)
  const lists = useTalentListStore((s) => s.lists)
  const fetchLists = useTalentListStore((s) => s.fetchLists)

  // ── Form state ────────────────────────────────────────────────────────────
  const defaultName = useMemo(() => {
    if (query?.trim()) return `${query.trim()} · ${formatToday()}`
    return `名单 · ${formatToday()}`
  }, [query])

  const [name, setName] = useState(defaultName)
  const [projectId, setProjectId] = useState<string | ''>(currentProjectId ?? '')
  // candidate_id → keep selected? Default all = true.
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  // 'new' = create new list, otherwise = list id to append to
  const [target, setTarget] = useState<'new' | string>('new')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setProjectId(currentProjectId ?? '')
      setSelected(Object.fromEntries(candidates.map((c) => [c.id, true])))
      setTarget('new')
      setError(null)
      fetchProjects()
      fetchLists()
    }
  }, [open, defaultName, currentProjectId, candidates, fetchProjects, fetchLists])

  const selectedCount = Object.values(selected).filter(Boolean).length
  const allSelected = selectedCount === candidates.length && candidates.length > 0
  const noneSelected = selectedCount === 0

  const toggleAll = () => {
    if (allSelected) setSelected({})
    else setSelected(Object.fromEntries(candidates.map((c) => [c.id, true])))
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (target === 'new' && !name.trim()) {
      setError('请填写名单名称')
      return
    }
    if (selectedCount === 0) {
      setError('请至少勾选一个候选人')
      return
    }
    const candidateIds = candidates.filter((c) => selected[c.id]).map((c) => c.id)
    setSaving(true)
    setError(null)
    try {
      if (target === 'new') {
        await createList({
          name: name.trim(),
          project_id: projectId || null,
          filters_json: filtersJson,
          source: 'manual',
          candidate_ids: candidateIds,
        })
      } else {
        await updateMembers(target, candidateIds)
      }
      onClose()
    } catch (e) {
      setError(`保存失败：${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Append-mode candidates list filtering ─────────────────────────────────
  const appendableLists: TalentListSummaryResponse[] = useMemo(() => lists, [lists])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-base flex items-center gap-2">
            <Bookmark size={16} className="text-primary" />
            保存搜索结果到名单
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pt-2 pr-1">
          {/* Target switcher */}
          <div className="flex gap-1 p-1 bg-surface-container-low rounded-lg">
            <button
              onClick={() => setTarget('new')}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
                target === 'new'
                  ? 'bg-white shadow text-on-surface'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              新建名单
            </button>
            <button
              onClick={() => {
                if (appendableLists.length === 0) {
                  setError('暂无可追加的名单，请先创建一个')
                  return
                }
                setTarget(appendableLists[0].id)
                setError(null)
              }}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
                target !== 'new'
                  ? 'bg-white shadow text-on-surface'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              追加到已有
            </button>
          </div>

          {/* New-list fields */}
          {target === 'new' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5">
                  名单名称
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：新加坡 AI 部署 - 备选池"
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface outline-none border border-transparent focus:border-primary/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5">
                  关联项目（可选）
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface outline-none border border-transparent focus:border-primary/20 transition-colors"
                >
                  <option value="">未绑定（孤立名单）</option>
                  {currentProject && (
                    <option value={currentProject.id}>
                      ★ 当前 · {currentProject.project_name} · {currentProject.client_name}
                    </option>
                  )}
                  {projects
                    .filter((p) => p.id !== currentProject?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_name} · {p.client_name}
                      </option>
                    ))}
                </select>
                {!projectId && (
                  <p className="text-[10px] text-secondary/70 mt-1">
                    孤立名单仍会出现在「名单」侧边栏，可以稍后绑定到项目
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-1.5">
                选择已有名单
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-sm text-on-surface outline-none border border-transparent focus:border-primary/20 transition-colors"
              >
                {appendableLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.project_name ? ` · ${l.project_name}` : ' · 未绑定'}
                    {' · '}{l.member_count} 人
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-secondary/70 mt-1">
                重复的候选人会自动跳过
              </p>
            </div>
          )}

          {/* Candidate picker */}
          <div className="border border-outline-variant/15 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-surface-container-low flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                候选人（{selectedCount} / {candidates.length}）
              </p>
              <button
                onClick={toggleAll}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant/10">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[c.id]}
                    onChange={() => toggleOne(c.id)}
                    className="rounded accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{c.full_name}</p>
                    <p className="text-[11px] text-secondary truncate">
                      {[c.current_title, c.current_company].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 px-1">{error}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || noneSelected}
            className="flex items-center gap-2 px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatToday(): string {
  const d = new Date()
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
