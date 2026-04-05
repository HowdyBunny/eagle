import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import { useProjectStore } from '@/stores/project-store'
import AgentBubble from './AgentBubble'
import UserBubble from './UserBubble'
import ChatInput from './ChatInput'
import ProjectIntroBubble from './ProjectIntroBubble'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

// Placeholder used when CA hasn't parsed client/position yet.
// Backend / CA should update these fields via its tools after analyzing
// the hunter's first message.
const PLACEHOLDER_NAME = '待 CA 解析'

function deriveStubProjectName(text: string): string {
  const line = text.split('\n')[0].trim()
  return line.length > 40 ? line.slice(0, 40) + '…' : line || PLACEHOLDER_NAME
}

export default function ChatView() {
  const { currentProjectId, currentProject, selectProject } = useAppStore()
  const { messages, sending, loadHistory, sendMessage } = useChatStore()
  const { createProject } = useProjectStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reload history whenever the bound project changes (1:1 conversation).
  useEffect(() => {
    if (currentProjectId) loadHistory(currentProjectId)
  }, [currentProjectId, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, bootstrapping])

  const handleSend = async (message: string) => {
    setError(null)
    // Normal case: project already bound, just chat.
    if (currentProjectId) {
      sendMessage(currentProjectId, message)
      return
    }

    // First-message case: create a stub project from the blob, then chat.
    // CA is expected to parse client/position/requirement from the message
    // and update the project's metadata via its tools.
    setBootstrapping(true)
    try {
      const project = await createProject({
        client_name: PLACEHOLDER_NAME,
        project_name: deriveStubProjectName(message),
        jd_raw: message,
        mode: 'precise',
      })
      selectProject(project)
      // loadHistory runs via effect; it will reset messages to [] for the
      // brand-new project. Then dispatch the user's message as the opener.
      await loadHistory(project.id)
      await sendMessage(project.id, message)
    } catch (e) {
      setError('创建项目失败：' + String(e))
    } finally {
      setBootstrapping(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {!currentProjectId && <ProjectIntroBubble />}

        {currentProjectId && messages.length === 0 && !sending && !bootstrapping && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl kinetic-gradient flex items-center justify-center shadow mb-4">
              <span className="text-white font-headline font-black text-lg">CA</span>
            </div>
            <p className="font-headline font-bold text-base text-on-surface mb-2">
              你好，我是 Coordinator Agent
            </p>
            <p className="text-sm text-secondary max-w-sm leading-relaxed">
              当前项目：<strong className="text-on-surface">{currentProject?.project_name}</strong>
              <br />
              告诉我你需要找什么样的人才，或者有什么问题需要解答
            </p>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'assistant' ? (
            <AgentBubble key={msg.id} message={msg} />
          ) : (
            <UserBubble key={msg.id} message={msg} />
          )
        )}

        {(sending || bootstrapping) && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full kinetic-gradient flex items-center justify-center">
              <span className="text-white text-xs font-bold">CA</span>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-tr-3xl rounded-br-3xl rounded-bl-lg border-l-4 border-l-primary px-5 py-4">
              <LoadingSpinner size="sm" />
              {bootstrapping && (
                <p className="text-[11px] text-secondary mt-2">正在为你建立项目…</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={sending || bootstrapping} />
    </div>
  )
}
