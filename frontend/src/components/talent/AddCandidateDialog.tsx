import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCandidateStore } from '@/stores/candidate-store'

interface AddCandidateDialogProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
      {children}
    </label>
  )
}

export default function AddCandidateDialog({ open, onClose }: AddCandidateDialogProps) {
  const addCandidate = useCandidateStore((s) => s.addCandidate)

  const [form, setForm] = useState({
    full_name: '',
    current_title: '',
    current_company: '',
    location: '',
    years_experience: '',
    salary_range: '',
    education: '',
    phone: '',
    email: '',
    linkedin_url: '',
    liepin_url: '',
    experience_summary: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleClose = () => {
    setForm({
      full_name: '', current_title: '', current_company: '', location: '',
      years_experience: '', salary_range: '', education: '',
      phone: '', email: '', linkedin_url: '', liepin_url: '', experience_summary: '',
    })
    setError('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('姓名为必填项'); return }
    setLoading(true)
    setError('')
    try {
      await addCandidate({
        full_name: form.full_name.trim(),
        current_title: form.current_title.trim() || null,
        current_company: form.current_company.trim() || null,
        location: form.location.trim() || null,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        salary_range: form.salary_range.trim() || null,
        education: form.education.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        liepin_url: form.liepin_url.trim() || null,
        experience_summary: form.experience_summary.trim() || null,
        source_platform: 'manual',
      })
      handleClose()
    } catch {
      setError('添加失败，请检查后端连接')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-base">手动添加候选人</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 姓名 — full width, required */}
          <div>
            <Label>姓名 <span className="text-red-500 normal-case font-normal">*</span></Label>
            <input
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder="张三"
              className={inputClass}
            />
          </div>

          {/* 职位 / 公司 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>当前职位</Label>
              <input
                value={form.current_title}
                onChange={(e) => set('current_title', e.target.value)}
                placeholder="高级工程师"
                className={inputClass}
              />
            </div>
            <div>
              <Label>当前公司</Label>
              <input
                value={form.current_company}
                onChange={(e) => set('current_company', e.target.value)}
                placeholder="某科技有限公司"
                className={inputClass}
              />
            </div>
          </div>

          {/* 地点 / 工作年限 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>地点</Label>
              <input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="上海"
                className={inputClass}
              />
            </div>
            <div>
              <Label>工作年限</Label>
              <input
                type="number"
                min={0}
                value={form.years_experience}
                onChange={(e) => set('years_experience', e.target.value)}
                placeholder="8"
                className={inputClass}
              />
            </div>
          </div>

          {/* 薪资 / 教育 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>薪资范围</Label>
              <input
                value={form.salary_range}
                onChange={(e) => set('salary_range', e.target.value)}
                placeholder="30-50k"
                className={inputClass}
              />
            </div>
            <div>
              <Label>教育背景</Label>
              <input
                value={form.education}
                onChange={(e) => set('education', e.target.value)}
                placeholder="清华大学 · 计算机硕士"
                className={inputClass}
              />
            </div>
          </div>

          {/* 手机 / 邮箱 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>手机号</Label>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="138 0000 0000"
                className={inputClass}
              />
            </div>
            <div>
              <Label>邮箱</Label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="example@company.com"
                className={inputClass}
              />
            </div>
          </div>

          {/* 经历摘要 */}
          <div>
            <Label>经历摘要</Label>
            <textarea
              value={form.experience_summary}
              onChange={(e) => set('experience_summary', e.target.value)}
              placeholder="曾负责核心支付系统架构设计，带领 10 人团队完成日均亿级流量平台建设..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* LinkedIn / 猎聘 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>LinkedIn URL</Label>
              <input
                value={form.linkedin_url}
                onChange={(e) => set('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div>
              <Label>猎聘 URL</Label>
              <input
                value={form.liepin_url}
                onChange={(e) => set('liepin_url', e.target.value)}
                placeholder="https://www.liepin.com/resume/..."
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50"
            >
              {loading ? '添加中...' : '添加候选人'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
