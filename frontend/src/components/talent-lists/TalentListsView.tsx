import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, FolderOpen, Trash2 } from 'lucide-react'
import { useTalentListStore, type ProjectFilter } from '@/stores/talent-list-store'
import { useAppStore } from '@/stores/app-store'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import type { TalentListMemberStatus, TalentListSummaryResponse } from '@/types'

// Status labels for the inline progress chips. Order mirrors a hunter's typical
// outreach funnel: not_contacted → contacted → replied → scheduled → declined.
// added_to_project sits at the end because it represents exit from this list.
const STATUS_DEFS: { key: TalentListMemberStatus; label: string; color: string }[] = [
  { key: 'not_contacted', label: '未联系', color: 'text-secondary' },
  { key: 'contacted', label: '已联系', color: 'text-blue-600' },
  { key: 'scheduled', label: '已约面', color: 'text-amber-600' },
  { key: 'declined', label: '已拒绝', color: 'text-red-500' },
  { key: 'added_to_project', label: '已推进', color: 'text-primary' },
]

const FILTER_LABELS: Record<ProjectFilter, string> = {
  all: '全部名单',
  current: '仅当前项目',
  unassigned: '仅未绑定',
}

export default function TalentListsView() {
  const navigate = useNavigate()
  const currentProject = useAppStore((s) => s.currentProject)
  const { lists, loading, projectFilter, setProjectFilter, fetchLists, deleteList } =
    useTalentListStore()

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchLists({ projectId: currentProject?.id ?? null })
  }, [fetchLists, projectFilter, currentProject?.id])

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null)
    await deleteList(id)
  }

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline font-black text-2xl tracking-tight text-on-surface">
            名单
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            保存的人才名单，用于追踪外联进度 ·
            <span className="text-secondary/60"> 全局可见，可绑定到具体项目</span>
          </p>
        </div>

        {/* Filter switch */}
        <div className="flex gap-1 p-1 bg-surface-container-low rounded-lg">
          {(['all', 'current', 'unassigned'] as ProjectFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setProjectFilter(key)}
              disabled={key === 'current' && !currentProject}
              title={
                key === 'current' && !currentProject
                  ? '请先在对话或项目页选择一个项目'
                  : undefined
              }
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors disabled:opacity-40 ${
                projectFilter === key
                  ? 'bg-white shadow text-on-surface'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: '名单总数',
            value: lists.length,
          },
          {
            label: '候选人总数',
            value: lists.reduce((s, l) => s + l.member_count, 0),
          },
          {
            label: '已推进数',
            value: lists.reduce(
              (s, l) => s + (l.status_counts.added_to_project ?? 0),
              0,
            ),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm p-5 border-l-4 border-l-primary"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              {label}
            </p>
            <p className="font-headline font-black text-4xl tracking-tighter text-on-surface">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Lists */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : lists.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="暂无名单"
          description="在「人才库」搜索后，点击「保存搜索」即可创建一个名单来追踪外联进度"
          action={{ label: '前往人才库', onClick: () => navigate('/talent') }}
        />
      ) : (
        <div className="space-y-3">
          {lists.map((l) => (
            <ListRow
              key={l.id}
              list={l}
              pendingDelete={pendingDeleteId === l.id}
              onSelect={() => navigate(`/talent-lists/${l.id}`)}
              onDeleteClick={() => setPendingDeleteId(l.id)}
              onDeleteCancel={() => setPendingDeleteId(null)}
              onDeleteConfirm={() => confirmDelete(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ListRowProps {
  list: TalentListSummaryResponse
  pendingDelete: boolean
  onSelect: () => void
  onDeleteClick: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}

function ListRow({
  list,
  pendingDelete,
  onSelect,
  onDeleteClick,
  onDeleteCancel,
  onDeleteConfirm,
}: ListRowProps) {
  return (
    <div
      onClick={onSelect}
      className="group bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm p-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Name + project tag */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-headline font-bold text-base text-on-surface truncate">
              {list.name}
            </h3>
            {list.project_id ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                <FolderOpen size={10} />
                {list.project_name}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-secondary">
                未绑定
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-secondary">
              {list.member_count} 人
            </span>
          </div>

          {/* Client subtext */}
          {list.client_name && (
            <p className="text-[11px] text-secondary mb-2">{list.client_name}</p>
          )}

          {/* Status breakdown */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {STATUS_DEFS.map((s) => {
              const count = list.status_counts[s.key] ?? 0
              if (count === 0) return null
              return (
                <span key={s.key} className={`font-bold ${s.color}`}>
                  {s.label} {count}
                </span>
              )
            })}
            {list.member_count === 0 && (
              <span className="text-secondary/50 italic">名单为空</span>
            )}
          </div>
        </div>

        {/* Right side: timestamp + delete */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="text-[10px] text-secondary">
            {formatRelative(list.updated_at)}
          </p>
          {pendingDelete ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5"
            >
              <span className="text-[10px] text-secondary">删除？</span>
              <button
                onClick={onDeleteConfirm}
                className="text-[10px] font-bold text-red-500 hover:text-red-700"
              >
                确认
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-[10px] text-secondary hover:text-on-surface"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteClick()
              }}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
              title="删除名单"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
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
