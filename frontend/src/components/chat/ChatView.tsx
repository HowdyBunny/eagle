import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import { bootstrapProject, type BootstrapEvent } from '@/lib/ws-bootstrap'
import AgentBubble from './AgentBubble'
import UserBubble from './UserBubble'
import ChatInput from './ChatInput'
import ProjectIntroBubble from './ProjectIntroBubble'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

export default function ChatView() {
  const { currentProjectId, currentProject, authApiKey, selectProject } = useAppStore()
  const { messages, sending, _sendingProjectId, loadHistory, sendMessage } = useChatStore()
  const isSendingHere = sending && _sendingProjectId === currentProjectId
  const bottomRef = useRef<HTMLDivElement>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup WS on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  // Reload history whenever the bound project changes (1:1 conversation).
  useEffect(() => {
    if (currentProjectId) loadHistory(currentProjectId)
  }, [currentProjectId, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, bootstrapping])

  const handleBootstrapEvent = useCallback((event: BootstrapEvent) => {
    switch (event.type) {
      case 'status':
        setBootstrapStatus(event.message ?? null)
        break

      case 'project_created':
        if (event.project) {
          selectProject(event.project)
        }
        break

      case 'project_updated':
        // CA filled in the real client_name / project_name
        if (event.project) {
          selectProject(event.project)
        }
        break

      case 'ca_reply':
        // Bootstrap complete — reload full history (includes both user msg + CA reply)
        setBootstrapping(false)
        setBootstrapStatus(null)
        break

      case 'done': {
        setBootstrapping(false)
        setBootstrapStatus(null)
        // Reload history from the project that was created
        const projectId = useAppStore.getState().currentProjectId
        if (projectId) loadHistory(projectId)
        break
      }

      case 'error':
        setError(event.message ?? '未知错误')
        setBootstrapping(false)
        setBootstrapStatus(null)
        break
    }
  }, [selectProject, loadHistory])

  const handleSend = async (message: string) => {
    setError(null)
    // Normal case: project already bound, just chat.
    if (currentProjectId) {
      sendMessage(currentProjectId, message)
      return
    }

    // First-message case: use WebSocket bootstrap flow
    // Creates stub project → CA analyzes → updates project metadata → returns reply
    // All streamed as structured events with real-time progress
    setBootstrapping(true)
    setBootstrapStatus('正在连接…')

    cleanupRef.current = bootstrapProject(
      message,
      authApiKey,
      'precise',
      handleBootstrapEvent,
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        {!currentProjectId && <ProjectIntroBubble />}

        {currentProjectId && messages.length === 0 && !isSendingHere && !bootstrapping && (
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

        {(isSendingHere || bootstrapping) && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full kinetic-gradient flex items-center justify-center">
              <span className="text-white text-xs font-bold">CA</span>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-tr-3xl rounded-br-3xl rounded-bl-lg border-l-4 border-l-primary px-5 py-4">
              <LoadingSpinner size="sm" />
              {bootstrapping && (
                <p className="text-[11px] text-secondary mt-2">{bootstrapStatus ?? '正在为你建立项目…'}</p>
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

      <ChatInput onSend={handleSend} disabled={isSendingHere || bootstrapping} />
    </div>
  )
}
