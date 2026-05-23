import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Loader2,
  Mail,
  Phone,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { useTalentListStore } from '@/stores/talent-list-store'
import { useProjectStore } from '@/stores/project-store'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'
import CandidateDetailSheet from '@/components/talent/CandidateDetailSheet'
import EvaluationReportDrawer from '@/components/projects/EvaluationReportDrawer'
import type {
  CandidateResponse,
  ProjectCandidateResponse,
  TalentListMemberResponse,
  TalentListMemberStatus,
} from '@/types'

// ── Status taxonomy ───────────────────────────────────────────────────────────
const STATUS_LIST: { key: TalentListMemberStatus; label: string; color: string; dot: string }[] = [
  { key: 'not_contacted', label: '未联系', color: 'text-secondary', dot: 'bg-zinc-300' },
  { key: 'contacted', label: '已联系', color: 'text-blue-600', dot: 'bg-blue-500' },
  { key: 'scheduled', label: '已约面', color: 'text-amber-600', dot: 'bg-amber-500' },
  { key: 'declined', label: '已拒绝', color: 'text-red-500', dot: 'bg-red-500' },
  { key: 'added_to_project', label: '已推进', color: 'text-primary', dot: 'bg-primary' },
]

const STATUS_BY_KEY = Object.fromEntries(STATUS_LIST.map((s) => [s.key, s])) as Record<
  TalentListMemberStatus,
  (typeof STATUS_LIST)[number]
>

export default function TalentListDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentList,
    loadingDetail,
    fetchList,
    updateList,
    updateMemberStatus,
    updateMemberNote,
    removeMember,
    promoteMemberToProject,
    clearCurrentList,
  } = useTalentListStore()
  const projects = useProjectStore((s) => s.projects)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState<TalentListMemberStatus | 'all'>('all')
  const [hideAdded, setHideAdded] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [editName, setEditName] = useState('')
  // Currently-open evaluation drawer (set when the recruiter clicks an
  // "已推进" badge that has finished EA evaluation).
  const [selectedEvaluation, setSelectedEvaluation] =
    useState<ProjectCandidateResponse | null>(null)
  // candidate_id → true while their promote request is in flight. Used to
  // disable the button so the recruiter can't fire duplicate requests while
  // the first one's response is still on the wire.
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set())
  // Last failure message; shown as a small banner above the table. Cleared
  // automatically on the next successful promote.
  const [promoteError, setPromoteError] = useState<string | null>(null)
  // Bulk-promote UI state. `bulkConfirm` shows the inline confirm chip in the
  // header; `bulkProgress` shows live "X / N" progress while requests are in
  // flight. Null when no bulk operation is happening.
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (id) fetchList(id)
    fetchProjects()
    return () => clearCurrentList()
  }, [id, fetchList, fetchProjects, clearCurrentList])

  // Poll the list while any added_to_project member is still being evaluated
  // (no project_evaluation row yet, or evaluated_at not set). Stops polling
  // when all promoted members have completed evaluation. 5s interval matches
  // backend's recommended poll cadence for the evaluation status endpoint.
  //
  // Paused while a promote is in flight: a polling response that races a
  // pending promote would replace the optimistic state with the not-yet-
  // updated server state, making the row flicker back to "未联系" until the
  // promote completes. Re-enables automatically once promotingIds drains.
  useEffect(() => {
    if (!id || !currentList) return
    if (promotingIds.size > 0) return
    const inProgress = currentList.members.some(
      (m) =>
        m.status === 'added_to_project' &&
        (!m.project_evaluation || m.project_evaluation.evaluated_at === null),
    )
    if (!inProgress) return
    const timer = setInterval(() => {
      fetchList(id)
    }, 5000)
    return () => clearInterval(timer)
  }, [id, currentList, fetchList, promotingIds])

  if (loadingDetail || !currentList) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const members = currentList.members
  const filteredMembers = members.filter((m) => {
    if (hideAdded && m.status === 'added_to_project') return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    return true
  })

  // ── Project binding ───────────────────────────────────────────────────────
  const handleBindProject = async (projectId: string | null) => {
    setShowProjectPicker(false)
    await updateList(currentList.id, { project_id: projectId })
  }

  // ── Promote (trigger evaluation) ──────────────────────────────────────────
  const handlePromote = async (candidateId: string) => {
    if (!currentList.project_id) return
    if (promotingIds.has(candidateId)) return // already in flight, ignore
    setPromotingIds((prev) => new Set(prev).add(candidateId))
    try {
      await promoteMemberToProject(currentList.id, candidateId, currentList.project_id)
      setPromoteError(null)
    } catch (err) {
      setPromoteError(`推进失败：${describePromoteError(err)}`)
    } finally {
      setPromotingIds((prev) => {
        const next = new Set(prev)
        next.delete(candidateId)
        return next
      })
    }
  }

  // ── Bulk promote ─────────────────────────────────────────────────────────
  // Eligibility: skip already-promoted (added_to_project) and explicitly-
  // declined members. The recruiter can re-evaluate declined ones individually
  // if they change their mind, but the bulk action respects their negative
  // signal as a pre-filter.
  const bulkEligible = members.filter(
    (m) => m.status !== 'added_to_project' && m.status !== 'declined',
  )
  const handleBulkPromote = async () => {
    if (!currentList.project_id || bulkEligible.length === 0) return
    setBulkConfirm(false)
    const projectId = currentList.project_id
    setBulkProgress({ done: 0, total: bulkEligible.length })
    // Reflect every target candidate in promotingIds at once so each row's
    // 推进 button is disabled while the bulk job runs. We can't reuse the
    // single-row handlePromote because it would short-circuit on the
    // promotingIds.has() guard.
    setPromotingIds((prev) => {
      const next = new Set(prev)
      bulkEligible.forEach((m) => next.add(m.candidate_id))
      return next
    })
    const failures: string[] = []
    const tasks = bulkEligible.map(async (m) => {
      try {
        await promoteMemberToProject(currentList.id, m.candidate_id, projectId)
      } catch (err) {
        failures.push(`${m.candidate?.full_name ?? m.candidate_id.slice(0, 8)}: ${describePromoteError(err)}`)
      } finally {
        setBulkProgress((p) => (p ? { ...p, done: p.done + 1 } : null))
      }
    })
    await Promise.all(tasks)
    // Clear promotingIds for every candidate we touched. Use a single
    // setPromotingIds call to avoid N re-renders.
    setPromotingIds((prev) => {
      const next = new Set(prev)
      bulkEligible.forEach((m) => next.delete(m.candidate_id))
      return next
    })
    setBulkProgress(null)
    if (failures.length > 0) {
      const preview = failures.slice(0, 3).join('；')
      const more = failures.length > 3 ? ` 等 ${failures.length} 条` : ''
      setPromoteError(`一键推进失败 ${failures.length}/${bulkEligible.length}：${preview}${more}`)
    } else {
      setPromoteError(null)
    }
  }

  const handleRename = async () => {
    const next = editName.trim()
    if (next && next !== currentList.name) {
      await updateList(currentList.id, { name: next })
    }
    setRenaming(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {/* Back link */}
      <button
        onClick={() => navigate('/talent-lists')}
        className="flex items-center gap-1.5 text-xs text-secondary hover:text-on-surface mb-4 transition-colors"
      >
        <ArrowLeft size={13} />
        所有名单
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Bookmark size={18} className="text-primary shrink-0" />
            {renaming ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                className="font-headline font-black text-2xl tracking-tight bg-surface-container-low rounded px-2 py-0.5 outline-none border border-primary/20"
              />
            ) : (
              <h2
                onDoubleClick={() => {
                  setEditName(currentList.name)
                  setRenaming(true)
                }}
                title="双击重命名"
                className="font-headline font-black text-2xl tracking-tight text-on-surface truncate"
              >
                {currentList.name}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {currentList.project_id ? (
              <Link
                to={`/projects/${currentList.project_id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[11px] font-bold text-primary hover:bg-primary/15 transition-colors"
              >
                <FolderOpen size={11} />
                {currentList.project_name}
                <ExternalLink size={9} />
              </Link>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[11px] font-bold text-secondary">
                未绑定项目
              </span>
            )}
            <span className="text-[11px] text-secondary">
              {members.length} 人 · 更新于 {new Date(currentList.updated_at).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
        {/* Bulk-promote: only meaningful when the list is bound to a project. */}
        {currentList.project_id && (
          bulkProgress ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <Loader2 size={12} className="animate-spin" />
              推送中 {bulkProgress.done}/{bulkProgress.total}
            </span>
          ) : bulkConfirm ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs font-bold text-primary">
              确认推送 {bulkEligible.length} 位？
              <button
                onClick={handleBulkPromote}
                className="text-primary hover:underline"
              >
                确认
              </button>
              <button
                onClick={() => setBulkConfirm(false)}
                className="text-secondary hover:text-on-surface"
              >
                取消
              </button>
            </span>
          ) : (
            <button
              onClick={() => setBulkConfirm(true)}
              disabled={bulkEligible.length === 0}
              title={
                bulkEligible.length === 0
                  ? '没有可推送的候选人（全部已推进或已拒绝）'
                  : `推送 ${bulkEligible.length} 位候选人到项目评估`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg kinetic-gradient text-white text-xs font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowUpRight size={12} />
              一键推进 ({bulkEligible.length})
            </button>
          )
        )}
        <div className="relative">
          <button
            onClick={() => setShowProjectPicker((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant/20 text-xs font-bold text-secondary hover:text-on-surface hover:border-primary/30 transition-colors"
          >
            {currentList.project_id ? '更换项目绑定' : '关联到项目'}
          </button>
          {showProjectPicker && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-outline-variant/20 rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
              {currentList.project_id && (
                <button
                  onClick={() => handleBindProject(null)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-surface-container-low text-red-500 font-bold"
                >
                  解除绑定（变为未绑定）
                </button>
              )}
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-secondary">暂无项目</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleBindProject(p.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-container-low ${
                      p.id === currentList.project_id ? 'bg-primary/5 text-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    <p className="truncate">{p.project_name}</p>
                    <p className="text-[10px] text-secondary truncate">{p.client_name}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
            statusFilter === 'all'
              ? 'bg-on-surface text-white border-on-surface'
              : 'border-outline-variant/20 text-secondary hover:text-on-surface'
          }`}
        >
          全部 {members.length}
        </button>
        {STATUS_LIST.map((s) => {
          const count = members.filter((m) => m.status === s.key).length
          if (count === 0) return null
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                statusFilter === s.key
                  ? 'bg-on-surface text-white border-on-surface'
                  : 'border-outline-variant/20 text-secondary hover:text-on-surface'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label} {count}
            </button>
          )
        })}

        <div className="ml-auto">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hideAdded}
              onChange={(e) => setHideAdded(e.target.checked)}
              className="rounded accent-primary"
            />
            <span className="text-[11px] text-secondary">隐藏已推进</span>
          </label>
        </div>
      </div>

      {/* Promote error banner. Auto-clears on next successful promote. */}
      {promoteError && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-red-700">{promoteError}</p>
          <button
            onClick={() => setPromoteError(null)}
            className="text-[11px] text-red-500 hover:text-red-700 font-bold"
          >
            关闭
          </button>
        </div>
      )}

      {/* Members table */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={members.length === 0 ? '名单为空' : '没有匹配的候选人'}
          description={
            members.length === 0
              ? '前往人才库搜索并保存到此名单'
              : '试试调整上方的状态筛选'
          }
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
          {/* table-fixed locks column widths so per-cell content changes
              (status pill text, copy-confirmation, pending-delete confirm)
              don't reflow neighbouring columns. Without this, clicking the
              delete button on one row visibly shifts every other column. */}
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[16%]" />{/* 候选人 */}
              <col className="w-[14%]" />{/* 职位/公司 */}
              <col className="w-[20%]" />{/* 联系 */}
              <col className="w-[12%]" />{/* 状态 */}
              <col className="w-[18%]" />{/* 备注 */}
              <col className="w-[10%]" />{/* 上次更新 */}
              <col className="w-[10%]" />{/* 操作 */}
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                {[
                  { key: 'name', label: '候选人' },
                  { key: 'role', label: '职位 / 公司' },
                  {
                    key: 'contact',
                    label: (
                      <>
                        联系{' '}
                        <span className="normal-case tracking-normal font-bold text-secondary/60">
                          （点击复制）
                        </span>
                      </>
                    ),
                  },
                  { key: 'status', label: '推进状态' },
                  { key: 'note', label: '我的备注' },
                  { key: 'updated', label: '上次更新' },
                  { key: 'actions', label: '操作（点击推进会触发EA评估）' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isAddedToProject={m.status === 'added_to_project'}
                  canPromote={!!currentList.project_id && m.status !== 'added_to_project'}
                  pendingDelete={pendingDeleteId === m.candidate_id}
                  promoting={promotingIds.has(m.candidate_id)}
                  onOpenSheet={() => m.candidate && setSelectedCandidate(m.candidate)}
                  onOpenEvaluation={() => {
                    if (m.project_evaluation?.evaluated_at) {
                      setSelectedEvaluation(m.project_evaluation)
                    }
                  }}
                  onStatusChange={(s) => updateMemberStatus(currentList.id, m.candidate_id, s)}
                  onNoteSave={(note) => updateMemberNote(currentList.id, m.candidate_id, note)}
                  onPromote={() => handlePromote(m.candidate_id)}
                  onDeleteRequest={() => setPendingDeleteId(m.candidate_id)}
                  onDeleteCancel={() => setPendingDeleteId(null)}
                  onDeleteConfirm={async () => {
                    setPendingDeleteId(null)
                    await removeMember(currentList.id, m.candidate_id)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={selectedCandidate != null}
        onClose={() => setSelectedCandidate(null)}
      />

      {/* Evaluation drawer: editable so the recruiter can also update
          project_candidate.status (recommended/interviewed/eliminated) and
          hunter_feedback right from the list page — this is the only UI
          entry point for those fields anywhere in the app. */}
      <EvaluationReportDrawer
        evaluation={selectedEvaluation}
        open={selectedEvaluation != null}
        onClose={() => setSelectedEvaluation(null)}
        editable
        onUpdated={(updated) => {
          // Re-sync the local list so the row reflects the new
          // project_candidates state without an extra fetch.
          setSelectedEvaluation(updated)
          if (id) fetchList(id)
        }}
      />
    </div>
  )
}

// ── Member row ────────────────────────────────────────────────────────────────
interface MemberRowProps {
  member: TalentListMemberResponse
  isAddedToProject: boolean
  canPromote: boolean
  pendingDelete: boolean
  promoting: boolean
  onOpenSheet: () => void
  onOpenEvaluation: () => void
  onStatusChange: (s: TalentListMemberStatus) => void
  onNoteSave: (note: string) => void
  onPromote: () => void
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}

function MemberRow({
  member,
  isAddedToProject,
  canPromote,
  pendingDelete,
  promoting,
  onOpenSheet,
  onOpenEvaluation,
  onStatusChange,
  onNoteSave,
  onPromote,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: MemberRowProps) {
  const c = member.candidate
  if (!c) return null

  return (
    <tr
      className={`group hover:bg-surface-container-low transition-colors ${
        isAddedToProject ? 'opacity-65' : ''
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full kinetic-gradient flex items-center justify-center text-white font-headline font-black text-xs shrink-0">
            {c.full_name.charAt(0)}
          </div>
          <button
            onClick={onOpenSheet}
            className="text-left min-w-0 hover:text-primary transition-colors"
          >
            <p className="text-sm font-semibold text-on-surface truncate">
              {c.full_name}
            </p>
            <p className="text-[11px] text-secondary truncate">
              {c.location ?? '—'} · 加入于{' '}
              {new Date(member.added_at).toLocaleDateString('zh-CN')}
            </p>
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-on-surface truncate">{c.current_title ?? '—'}</p>
        <p className="text-[11px] text-secondary truncate">{c.current_company ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        <ContactIcons candidate={c} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5 items-start">
          <StatusDropdown
            value={member.status}
            onChange={onStatusChange}
          />
          {isAddedToProject && (
            <EvaluationBadge
              evaluation={member.project_evaluation}
              onClick={onOpenEvaluation}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        <NoteCell note={member.hunter_note} onSave={onNoteSave} />
      </td>
      <td className="px-4 py-3 text-[11px] text-secondary whitespace-nowrap">
        {formatRelative(member.updated_at)}
      </td>
      <td className="px-4 py-3">
        {pendingDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-secondary">移除？</span>
            <button
              onClick={onDeleteConfirm}
              className="text-[11px] font-bold text-red-500 hover:text-red-700"
            >
              确认
            </button>
            <button
              onClick={onDeleteCancel}
              className="text-[11px] text-secondary hover:text-on-surface"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPromote && (
              <button
                onClick={onPromote}
                disabled={promoting}
                title={promoting ? '正在推进...' : '推进到项目评估'}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {promoting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ArrowUpRight size={12} />
                )}
                {promoting ? '推进中' : '推进'}
              </button>
            )}
            <button
              onClick={onDeleteRequest}
              className="text-red-400 hover:text-red-600 transition-colors"
              title="从名单移除"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Status inline dropdown ────────────────────────────────────────────────────
// The trigger lives inside the members table, which has `overflow-hidden` on
// its rounded wrapper. An absolutely-positioned menu inside that wrapper would
// be clipped at the table edges. We render the menu into a portal at
// document.body and position it via the trigger's bounding rect so it floats
// freely above all stacking contexts.
function StatusDropdown({
  value,
  onChange,
}: {
  value: TalentListMemberStatus
  onChange: (s: TalentListMemberStatus) => void
}) {
  // Dropdown is always interactive: even when the current status is
  // `added_to_project`, the recruiter may need to undo a misclick. The five
  // outreach statuses are pickable; `added_to_project` itself isn't in the
  // option list (that status is only ever set atomically by the "推进"
  // button, which also creates the project_candidates row). Reverting from
  // it via the dropdown leaves the project-level evaluation alone — that's
  // shown as a hint inside the menu.
  const isAddedToProject = value === 'added_to_project'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const meta = STATUS_BY_KEY[value]

  const openMenu = () => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setCoords({ top: r.bottom + 4, left: r.left })
    setOpen(true)
  }

  // Close on outside click. We allow clicks inside the portaled menu by
  // matching against menuRef.current as well as the trigger itself.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Any scroll or resize would orphan the menu from its trigger; the cheap
  // correct fix is to just close it (lighter than reflow-tracking).
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    // capture=true so nested scrollers (the page itself, modal scrollers) all fire.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors border-outline-variant/20 hover:border-primary/30 ${meta.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
        <ChevronDown size={10} />
      </button>
      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="w-44 bg-white border border-outline-variant/20 rounded-lg shadow-lg z-[1000] py-1"
          >
            {STATUS_LIST.filter((s) => s.key !== 'added_to_project').map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  onChange(s.key)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-container-low ${
                  value === s.key ? 'bg-primary/5' : ''
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className={s.color}>{s.label}</span>
                {value === s.key && <Check size={11} className="ml-auto text-primary" />}
              </button>
            ))}
            <p className="px-3 pt-1.5 pb-1 border-t border-outline-variant/10 text-[10px] text-secondary/60 leading-snug">
              {isAddedToProject
                ? '改回外联状态后，项目下的评估记录会保留'
                : '「已推进」由「⬆ 推进」按钮自动标注'}
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Inline note cell ──────────────────────────────────────────────────────────
function NoteCell({
  note,
  onSave,
}: {
  note: string | null
  onSave: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')

  useEffect(() => {
    setDraft(note ?? '')
  }, [note])

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== (note ?? '')) onSave(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(note ?? '')
            setEditing(false)
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            ;(e.target as HTMLTextAreaElement).blur()
          }
        }}
        rows={2}
        placeholder="例如：5/22 已发邮件，等回复"
        maxLength={200}
        className="w-full bg-surface-container-low rounded-md px-2 py-1.5 text-[12px] text-on-surface outline-none border border-primary/20 resize-none"
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left text-[12px] text-on-surface hover:bg-surface-container-low rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
    >
      {note ? (
        <span className="whitespace-pre-wrap line-clamp-2">{note}</span>
      ) : (
        <span className="text-secondary/40 italic">点击添加备注</span>
      )}
    </button>
  )
}

// ── Contact list (visible values, click-to-copy) ──────────────────────────────
// Recruiters want to *see* the phone/email at a glance (esp. for mobile use)
// without having to hover a tooltip. We render each available channel as its
// own stacked row with the value inline, and clicking the row copies the value
// (or opens the link for LinkedIn).
function ContactIcons({ candidate }: { candidate: CandidateResponse }) {
  const hasAny = candidate.phone || candidate.email || candidate.linkedin_url
  if (!hasAny) {
    return <span className="text-[11px] text-secondary/40 italic">未提供</span>
  }
  return (
    <div className="flex flex-col gap-0.5 max-w-[220px]">
      {candidate.phone && (
        <ContactRow
          icon={<Phone size={11} />}
          value={candidate.phone}
          label="电话"
          mode="copy"
        />
      )}
      {candidate.email && (
        <ContactRow
          icon={<Mail size={11} />}
          value={candidate.email}
          label="邮箱"
          mode="copy"
        />
      )}
      {candidate.linkedin_url && (
        <ContactRow
          icon={<ExternalLink size={11} />}
          value="LinkedIn"
          href={candidate.linkedin_url}
          label="LinkedIn"
          mode="link"
        />
      )}
    </div>
  )
}

function ContactRow({
  icon,
  value,
  label,
  mode,
  href,
}: {
  icon: React.ReactNode
  value: string
  label: string
  mode: 'copy' | 'link'
  href?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (mode === 'link' && href) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard API can fail outside secure contexts; degrade silently.
    }
  }

  return (
    <button
      onClick={handleClick}
      title={mode === 'copy' ? `点击复制 ${label}：${value}` : `打开 ${label}`}
      className={`group/contact flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] text-on-surface hover:bg-surface-container-low transition-colors min-w-0 ${
        copied ? 'bg-emerald-500/15' : ''
      }`}
    >
      {/* Only the icon swaps to ✓ on copy; the value text stays put so the
          row width never changes (the table is already table-fixed, but
          keeping the value visible is also better UX — the hunter still
          sees what they copied). */}
      <span className={`shrink-0 ${copied ? 'text-emerald-600' : 'text-secondary'}`}>
        {copied ? <Check size={11} /> : icon}
      </span>
      <span
        className={`truncate flex-1 text-left tabular-nums ${
          copied ? 'text-emerald-700' : ''
        }`}
      >
        {value}
      </span>
    </button>
  )
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

/**
 * Pulls the most actionable string out of an axios failure. Axios reports
 * connection-layer failures as bare "Network Error" with no further context,
 * which has been the source of confusion for the recruiter ("why?"). When a
 * response WAS received, we surface its status + `detail` (FastAPI's standard
 * error shape) instead.
 */
function describePromoteError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      response?: { status?: number; data?: { detail?: unknown } | string }
      message?: string
      code?: string
    }
    if (e.response) {
      const status = e.response.status ?? '?'
      const data = e.response.data
      let detail: string | undefined
      if (typeof data === 'string') detail = data
      else if (data && typeof data === 'object' && 'detail' in data) {
        const d = (data as { detail: unknown }).detail
        detail = typeof d === 'string' ? d : JSON.stringify(d)
      }
      return detail ? `[HTTP ${status}] ${detail}` : `[HTTP ${status}]`
    }
    // No response received — likely connection-level. Include the axios code
    // (ERR_NETWORK / ECONNABORTED / etc.) so it's clear it's not a server bug.
    if (e.code) return `[${e.code}] ${e.message ?? 'Network Error'}（后端可能未响应）`
    if (e.message) return e.message
  }
  return String(err)
}

// ── Evaluation badge ──────────────────────────────────────────────────────────
// Rendered beneath the status dropdown when a member is `added_to_project`.
// Three variants based on the joined project_evaluation row:
//   - missing or evaluated_at null → ⏳ 评估中（spinner, not clickable）
//   - status === 'failed' → ⚠ 评估失败
//   - otherwise → ⭐ {score} 已评估（clickable, opens EvaluationReportDrawer）
function EvaluationBadge({
  evaluation,
  onClick,
}: {
  evaluation: ProjectCandidateResponse | null
  onClick: () => void
}) {
  // Still running — show spinner and disable click.
  if (!evaluation || evaluation.evaluated_at === null) {
    if (evaluation?.status === 'failed') {
      return (
        <span
          title="EA 评估失败，请回到项目页重新触发"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-bold text-red-600"
        >
          <AlertTriangle size={9} />
          评估失败
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
        <Loader2 size={9} className="animate-spin" />
        评估中
      </span>
    )
  }

  if (evaluation.status === 'failed') {
    return (
      <button
        onClick={onClick}
        title="点击查看评估错误详情"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-bold text-red-600 hover:border-red-300 transition-colors"
      >
        <AlertTriangle size={9} />
        评估失败
      </button>
    )
  }

  // Done — show score + project-level status if it's been advanced.
  const score = Math.round(evaluation.match_score ?? 0)
  const projectStatus = evaluation.status
  const projectStatusLabel =
    projectStatus === 'recommended'
      ? '已推荐'
      : projectStatus === 'interviewed'
        ? '已约面'
        : projectStatus === 'eliminated'
          ? '已淘汰'
          : null

  return (
    <button
      onClick={onClick}
      title="点击查看评估详情 / 修改项目状态"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[10px] font-bold text-primary hover:bg-primary/15 transition-colors"
    >
      <Star size={9} className="fill-primary" />
      {score}
      {projectStatusLabel && (
        <span className="ml-0.5 pl-1 border-l border-primary/25 normal-case tracking-normal">
          {projectStatusLabel}
        </span>
      )}
    </button>
  )
}
