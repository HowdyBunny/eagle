import ReactMarkdown from 'react-markdown'
import { Bot, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ConversationLogResponse } from '@/types'

interface AgentBubbleProps {
  message: ConversationLogResponse
  /** When true, renders a blinking cursor after the content */
  isStreaming?: boolean
}

export default function AgentBubble({ message, isStreaming = false }: AgentBubbleProps) {
  const [showActions, setShowActions] = useState(false)
  const hasActions = message.intent_json != null

  const time = new Date(message.created_at).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex items-start gap-3 max-w-[80%]">
      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full kinetic-gradient flex items-center justify-center shadow-sm">
        <Bot size={16} className="text-white" />
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1">
        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-tr-3xl rounded-br-3xl rounded-bl-lg border-l-4 border-l-primary px-5 py-4 shadow-sm">
          <div className="prose prose-sm max-w-none text-on-surface
            prose-headings:font-headline prose-headings:font-black prose-headings:tracking-tight
            prose-p:text-sm prose-p:leading-relaxed prose-p:text-on-surface
            prose-strong:text-on-surface prose-code:bg-surface-container-low prose-code:px-1 prose-code:rounded
            prose-ul:text-sm prose-li:text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-[2px] h-[1em] bg-primary align-middle ml-0.5 animate-pulse" />
            )}
          </div>

          {/* Agent actions */}
          {hasActions && (
            <div className="mt-3 pt-3 border-t border-outline-variant/10">
              <button
                onClick={() => setShowActions(!showActions)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity"
              >
                Agent 操作记录
                <ChevronDown size={12} className={`transition-transform ${showActions ? 'rotate-180' : ''}`} />
              </button>
              {showActions && (
                <pre className="mt-2 text-[11px] text-secondary bg-surface-container-low rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(message.intent_json, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-secondary/60 pl-1">{time}</span>
      </div>
    </div>
  )
}
