import { useState, useRef, useEffect } from 'react'
import { Send, Zap } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  disableQuickActions?: boolean
}

const QUICK_ACTIONS = [
  { label: '搜索匹配人才', message: '请在人才库中搜索与当前项目需求匹配的候选人' },
  { label: '生成行业报告', message: '请触发 Research Agent 对当前项目所在行业进行调研' },
]

export default function ChatInput({ onSend, disabled, disableQuickActions }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [text])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="sticky bottom-0 glass-overlay border-t border-outline-variant/10 px-6 py-4">
      {/* Quick actions */}
      <div className="flex gap-2 mb-3">
        {QUICK_ACTIONS.map(({ label, message }) => (
          <button
            key={label}
            onClick={() => onSend(message)}
            disabled={disabled || disableQuickActions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-[11px] font-bold text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40"
          >
            <Zap size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-3">
        <div className="flex-1 bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/10 focus-within:border-primary/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向 Coordinator Agent 发送消息..."
            rows={1}
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-secondary/50 resize-none outline-none leading-relaxed"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          className="w-11 h-11 rounded-xl kinetic-gradient flex items-center justify-center text-white hover:shadow-lg hover:-translate-y-0.5 transition-all scale-98-active disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-[10px] text-secondary/50 mt-2 text-center">Enter 发送 · Shift+Enter 换行</p>
    </div>
  )
}
