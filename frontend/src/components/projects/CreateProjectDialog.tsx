import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProjectStore } from '@/stores/project-store'
import { useAppStore } from '@/stores/app-store'
import { useNavigate } from 'react-router-dom'
import type { ProjectMode } from '@/types'

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

export default function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const createProject = useProjectStore((s) => s.createProject)
  const selectProject = useAppStore((s) => s.selectProject)
  const navigate = useNavigate()

  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [jdRaw, setJdRaw] = useState('')
  const [mode, setMode] = useState<ProjectMode>('precise')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setClientName('')
    setProjectName('')
    setJdRaw('')
    setMode('precise')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !projectName.trim()) {
      setError('客户名称和项目名称为必填项')
      return
    }
    setLoading(true)
    setError('')
    try {
      const project = await createProject({
        client_name: clientName.trim(),
        project_name: projectName.trim(),
        jd_raw: jdRaw.trim() || null,
        mode,
      })
      selectProject(project)
      reset()
      onClose()
      navigate('/')
    } catch {
      setError('创建失败，请检查 API Key 和后端连接')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-base">新建招聘项目</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              客户名称 <span className="text-red-500">*</span>
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="某科技公司"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="技术 VP 招募"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              职位描述 JD（可选）
            </label>
            <textarea
              value={jdRaw}
              onChange={(e) => setJdRaw(e.target.value)}
              placeholder="粘贴原始 JD 或简述招聘需求..."
              rows={4}
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
              搜索模式
            </label>
            <div className="flex gap-3">
              {([['precise', '精准模式'], ['explore', '探索模式']] as [ProjectMode, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMode(val)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === val
                      ? 'kinetic-gradient text-white shadow-sm'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { reset(); onClose() }}
              className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建并选择'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
