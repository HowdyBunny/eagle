import { User } from 'lucide-react'
import type { ConversationLogResponse } from '@/types'

interface UserBubbleProps {
  message: ConversationLogResponse
}

export default function UserBubble({ message }: UserBubbleProps) {
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
        <div className="kinetic-gradient rounded-tl-3xl rounded-bl-3xl rounded-br-lg px-5 py-4 shadow-sm">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-secondary/60 pr-1">{time}</span>
      </div>
    </div>
  )
}
