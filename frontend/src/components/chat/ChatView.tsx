import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useUIStore } from '@/stores/ui-store'
import { useChatStore } from '@/stores/chat-store'
import { bootstrapProject, type BootstrapEvent } from '@/lib/ws-bootstrap'
import AgentBubble from './AgentBubble'
import UserBubble from './UserBubble'
import ChatInput from './ChatInput'
import ProjectIntroBubble from './ProjectIntroBubble'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

export default function ChatView() {
  const { currentProjectId, currentProject, selectProject, llmApiKey, embeddingApiKey } = useAppStore()
  const { openOnboarding } = useUIStore()
  const settingsOk = Boolean(llmApiKey && embeddingApiKey)
  const { messages, sending, streamingContent, streamingStatus, error: storeError, _sendingProjectId, loadHistory, sendMessage } = useChatStore()
  const isSendingHere = sending && _sendingProjectId === currentProjectId
  const bottomRef = useRef<HTMLDivElement>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null)
  const [bootstrapStreamingContent, setBootstrapStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const bootstrapDoneRef = useRef(false)

  // Reload history whenever the bound project changes (1:1 conversation).
  useEffect(() => {
    if (currentProjectId) loadHistory(currentProjectId)
  }, [currentProjectId, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, bootstrapping, streamingContent])

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

      case 'text':
        setBootstrapStreamingContent(prev => prev + (event.delta ?? ''))
        setBootstrapStatus(null)
        break

      case 'ca_reply':
        // Bootstrap complete — reload full history (includes both user msg + CA reply)
        setBootstrapping(false)
        setBootstrapStatus(null)
        setBootstrapStreamingContent('')
        break

      case 'done': {
        bootstrapDoneRef.current = true
        setBootstrapping(false)
        setBootstrapStatus(null)
        setBootstrapStreamingContent('')
        // Reload history from the project that was created
        const projectId = useAppStore.getState().currentProjectId
        if (projectId) loadHistory(projectId)
        break
      }

      case 'error':
        bootstrapDoneRef.current = true
        setError(event.message ?? '未知错误')
        setBootstrapping(false)
        setBootstrapStatus(null)
        setBootstrapStreamingContent('')
        break
    }
  }, [selectProject, loadHistory])

  const handleSend = async (message: string) => {
    setError(null)
    // Guard: open onboarding if LLM or Embedding is not configured
    if (!settingsOk) {
      openOnboarding()
      return
    }
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
    bootstrapDoneRef.current = false

    const cleanup = bootstrapProject(
      message,
      'precise',
      (event) => {
        handleBootstrapEvent(event)
        // Only close WS after the flow completes — not on component unmount
        if (event.type === 'done' || event.type === 'error') {
          cleanup()
        }
      },
    )
    cleanupRef.current = cleanup
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

        {/* Streaming text bubble — shown while final reply is being streamed */}
        {isSendingHere && streamingContent && (
          <AgentBubble
            message={{
              id: 'streaming',
              project_id: currentProjectId ?? '',
              role: 'assistant',
              content: streamingContent,
              intent_json: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Bootstrap streaming bubble */}
        {bootstrapping && bootstrapStreamingContent && (
          <AgentBubble
            message={{
              id: 'bootstrap-streaming',
              project_id: '',
              role: 'assistant',
              content: bootstrapStreamingContent,
              intent_json: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Spinner — shown during tool execution or while waiting for first token */}
        {((isSendingHere && !streamingContent) || (bootstrapping && !bootstrapStreamingContent)) && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full kinetic-gradient flex items-center justify-center">
              <span className="text-white text-xs font-bold">CA</span>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-tr-3xl rounded-br-3xl rounded-bl-lg border-l-4 border-l-primary px-5 py-4">
              <LoadingSpinner size="sm" />
              <p className="text-[11px] text-secondary mt-2">
                {bootstrapping
                  ? (bootstrapStatus ?? '正在为你建立项目…')
                  : (streamingStatus ?? 'CA 正在思考…')}
              </p>
            </div>
          </div>
        )}

        {(error || storeError) && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error || storeError}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Settings-missing banner — only shown when LLM/Embedding not configured */}
      {!settingsOk && (
        <div className="mx-6 mb-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700 truncate">
              {!llmApiKey && !embeddingApiKey
                ? 'LLM 和 Embedding 均未配置，CA 无法响应'
                : !llmApiKey
                ? 'LLM API Key 未配置，CA 无法响应'
                : 'Embedding API Key 未配置，候选人搜索不可用'}
            </span>
          </div>
          <button
            onClick={openOnboarding}
            className="flex-shrink-0 text-xs font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors"
          >
            立即配置
          </button>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isSendingHere || bootstrapping} />
    </div>
  )
}
