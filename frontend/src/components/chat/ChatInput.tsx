import { useState, useRef, useEffect } from 'react'
import { FileText, Loader2, Paperclip, Send, X, Zap } from 'lucide-react'
import { extractDoc } from '@/lib/api/talent'

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
  const [attachedDoc, setAttachedDoc] = useState<{ name: string; text: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)
  const justFinishedComposingRef = useRef(false)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [text])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setExtracting(true)
    setAttachedDoc(null)
    setExtractError(null)
    try {
      const result = await extractDoc(file)
      setAttachedDoc({ name: result.filename, text: result.text })
    } catch {
      setExtractError('文件解析失败，请确认格式为 PDF 或 Word，且非扫描件')
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = () => {
    if (disabled || extracting) return
    const trimmed = text.trim()
    if (!trimmed && !attachedDoc) return

    let messageToSend = trimmed
    if (attachedDoc) {
      const docSection = `以下是需求文件内容（${attachedDoc.name}）：\n\n${attachedDoc.text}`
      messageToSend = trimmed ? `${docSection}\n\n---\n${trimmed}` : docSection
    }

    onSend(messageToSend)
    setText('')
    setAttachedDoc(null)
    setExtractError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current && !justFinishedComposingRef.current) {
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

      {/* Attached doc chip */}
      {(extracting || attachedDoc || extractError) && (
        <div className="mb-2 flex items-center gap-2">
          {(extracting || attachedDoc) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/20 text-xs">
              {extracting ? (
                <Loader2 size={12} className="animate-spin text-primary shrink-0" />
              ) : (
                <FileText size={12} className="text-primary shrink-0" />
              )}
              <span className="font-medium text-on-surface">
                {extracting ? '解析中…' : attachedDoc!.name}
              </span>
              {!extracting && (
                <button
                  onClick={() => setAttachedDoc(null)}
                  className="ml-0.5 text-secondary hover:text-red-500 transition-colors"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}
          {extractError && (
            <span className="text-[11px] text-red-500">{extractError}</span>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3">
        <div className="flex-1 bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/10 focus-within:border-primary/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true }}
            onCompositionEnd={() => {
              isComposingRef.current = false
              justFinishedComposingRef.current = true
              setTimeout(() => { justFinishedComposingRef.current = false }, 0)
            }}
            placeholder="向 Coordinator Agent 发送消息..."
            rows={1}
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-secondary/50 resize-none outline-none leading-relaxed"
          />
        </div>

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || extracting}
          title="上传需求文件（PDF / Word）"
          className="w-11 h-11 rounded-xl bg-surface-container-low border border-outline-variant/10 flex items-center justify-center text-secondary hover:text-primary hover:border-primary/20 transition-colors disabled:opacity-40"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={(!text.trim() && !attachedDoc) || disabled || extracting}
          className="w-11 h-11 rounded-xl kinetic-gradient flex items-center justify-center text-white hover:shadow-lg hover:-translate-y-0.5 transition-all scale-98-active disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-[10px] text-secondary/50 mt-2 text-center">Enter 发送 · Shift+Enter 换行</p>
    </div>
  )
}
