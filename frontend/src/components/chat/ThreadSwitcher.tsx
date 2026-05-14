import { useEffect, useState } from 'react'
import { MessageSquarePlus, History, Pencil, Trash2, Check, X } from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  projectId: string
}

export default function ThreadSwitcher({ projectId }: Props) {
  const {
    threads,
    currentThreadId,
    threadsLoading,
    loadThreads,
    createThread,
    switchThread,
    renameThread,
    deleteThread,
  } = useChatStore()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    loadThreads(projectId)
  }, [projectId, loadThreads])

  const currentThread = threads.find((t) => t.id === currentThreadId)

  const handleCreate = async () => {
    const thread = await createThread(projectId)
    await switchThread(projectId, thread.id)
  }

  const handleSwitch = async (threadId: string | null) => {
    if (threadId === currentThreadId) return
    await switchThread(projectId, threadId)
  }

  const handleRenameStart = (e: React.MouseEvent, threadId: string, currentName: string) => {
    e.stopPropagation()
    setRenamingId(threadId)
    setRenameValue(currentName)
  }

  const handleRenameCommit = async () => {
    if (!renamingId || !renameValue.trim()) return
    await renameThread(projectId, renamingId, renameValue.trim())
    setRenamingId(null)
  }

  const handleRenameCancel = () => setRenamingId(null)

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation()
    await deleteThread(projectId, threadId)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Current thread name chip */}
      {currentThread && (
        <span className="text-xs text-secondary font-medium px-2 py-1 rounded-md bg-surface-container-low truncate max-w-[140px]">
          {currentThread.name}
        </span>
      )}

      {/* New thread button */}
      <button
        onClick={handleCreate}
        title="新建对话"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors"
      >
        <MessageSquarePlus size={14} />
        新建对话
      </button>

      {/* Thread history dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          title="历史对话"
          className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <History size={15} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          {threadsLoading && (
            <div className="px-3 py-2 text-xs text-secondary">加载中…</div>
          )}

          {!threadsLoading && threads.length === 0 && (
            <div className="px-3 py-2 text-xs text-secondary">暂无历史对话</div>
          )}

          {threads.map((thread) => {
            const isActive = thread.id === currentThreadId
            const isRenaming = renamingId !== null && renamingId === thread.id

            return (
              <div
                key={thread.id ?? 'legacy'}
                className={`group flex items-center gap-1 mx-1 my-0.5 rounded-md ${isActive ? 'bg-primary/10' : 'hover:bg-surface-container-low'}`}
              >
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCommit()
                        if (e.key === 'Escape') handleRenameCancel()
                      }}
                      className="flex-1 text-xs bg-surface-container-low rounded px-2 py-1 outline-none border border-primary/30"
                    />
                    <button onClick={handleRenameCommit} className="p-1 text-primary hover:opacity-70 flex-shrink-0">
                      <Check size={12} />
                    </button>
                    <button onClick={handleRenameCancel} className="p-1 text-secondary hover:opacity-70 flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer"
                      onClick={() => handleSwitch(thread.id)}
                    >
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <span className={`flex-1 truncate text-xs ${isActive ? 'text-primary font-medium' : 'text-on-surface'}`}>
                        {thread.name}
                      </span>
                    </button>

                    {/* Inline action buttons — only for real threads, not the legacy pseudo-thread */}
                    {!thread.is_legacy && thread.id !== null && (
                      <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => handleRenameStart(e, thread.id!, thread.name)}
                          title="重命名"
                          className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, thread.id!)}
                          title="删除"
                          className="p-1 rounded text-secondary hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
