import { User, AlertCircle, RotateCcw } from 'lucide-react'
import type { ConversationLogResponse } from '@/types'

interface UserBubbleProps {
  message: ConversationLogResponse
  failed?: boolean
  onRetry?: () => void
}

export default function UserBubble({ message, failed, onRetry }: UserBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center">
        <User size={16} className="text-zinc-500" />
      </div>

      <div className="flex flex-col gap-1 items-end">
        <div className={`rounded-tl-3xl rounded-bl-3xl rounded-br-lg px-5 py-4 shadow-sm ${failed ? 'bg-red-400/80' : 'kinetic-gradient'}`}>
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        {failed ? (
          <div className="flex items-center gap-2 pr-1">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-[10px] text-red-500">发送失败</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline"
              >
                <RotateCcw size={10} />
                重试
              </button>
            )}
          </div>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-secondary/60 pr-1">{time}</span>
        )}
      </div>
    </div>
  )
}
