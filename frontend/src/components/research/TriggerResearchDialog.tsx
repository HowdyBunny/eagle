import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useResearchStore } from '@/stores/research-store'

interface TriggerResearchDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
}

export default function TriggerResearchDialog({ open, onClose, projectId }: TriggerResearchDialogProps) {
  const triggerResearch = useResearchStore((s) => s.triggerResearch)
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) { setError('调研主题为必填项'); return }
    setLoading(true)
    setError('')
    try {
      await triggerResearch(projectId, topic.trim(), context.trim() || undefined)
      setTopic('')
      setContext('')
      onClose()
    } catch {
      setError('触发失败，请检查后端连接')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-base">触发行业调研</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              调研主题 <span className="text-red-500">*</span>
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="储能行业 / 大模型部署 / 量化交易..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              补充背景（可选）
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="重点关注方向，例如：逆变器和电池管理系统..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-[11px] text-secondary">
            Research Agent 将进行网页搜索，生成行业报告、技能图谱和知识库。通常需要 30-120 秒完成。
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors">
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50"
            >
              {loading ? '触发中...' : '开始调研'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
