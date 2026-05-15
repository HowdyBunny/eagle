import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Image, Loader2, Type, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCandidateStore } from '@/stores/candidate-store'
import * as talentApi from '@/lib/api/talent'
import type {
  ConfirmCandidateItem,
  DuplicateConflict,
  ParseResult,
  ParsedCandidateData,
} from '@/types/talent'

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputClass =
  'w-full bg-surface-container-low border-b-2 border-transparent focus:border-primary-container rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-secondary/50 outline-none transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
      {children}
    </label>
  )
}

// ── Completeness score helper ─────────────────────────────────────────────────
function completenessOf(d: ParsedCandidateData): number {
  let s = 0
  if (d.full_name) s += 20
  if (d.phone || d.email) s += 20
  if (d.current_title) s += 10
  if (d.current_company) s += 10
  if (d.years_experience != null) s += 10
  if (d.experience_summary) s += 15
  if (d.education) s += 10
  if (d.location) s += 5
  return s
}

// ── Conflict reason labels ────────────────────────────────────────────────────
const conflictLabel: Record<string, string> = {
  phone: '手机号完全匹配',
  email: '邮箱完全匹配',
  name_company: '姓名 + 公司相似',
}

// ── Source platform map ───────────────────────────────────────────────────────
const sourcePlatformOf = (inputType: 'images' | 'file' | 'text', fileType?: string) => {
  if (inputType === 'images') return 'image_import'
  if (inputType === 'text') return 'text_import'
  return fileType === 'pdf' ? 'pdf_import' : 'word_import'
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AddCandidateDialogProps {
  open: boolean
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AddCandidateDialog({ open, onClose }: AddCandidateDialogProps) {
  const addCandidate = useCandidateStore((s) => s.addCandidate)
  const fetchCandidates = useCandidateStore((s) => s.fetchCandidates)

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('ai')

  // ── Manual form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: '', current_title: '', current_company: '', location: '',
    years_experience: '', salary_range: '', education: '',
    phone: '', email: '', linkedin_url: '', liepin_url: '', experience_summary: '',
  })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')

  // ── AI tab state ───────────────────────────────────────────────────────────
  type AiInputType = 'images' | 'file' | 'text'
  type ParseStep = 'input' | 'parsing' | 'preview' | 'importing'

  const [aiInputType, setAiInputType] = useState<AiInputType>('images')
  const [batchMode, setBatchMode] = useState(false)
  const [pastedImages, setPastedImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'pdf' | 'word'>('pdf')
  const [pastedText, setPastedText] = useState('')
  const [parseStep, setParseStep] = useState<ParseStep>('input')
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  // Per-result conflict actions: index → { action, existing_id }
  const [conflictActions, setConflictActions] = useState<
    Record<number, { action: 'create' | 'skip' | 'overwrite'; existing_id?: string }>
  >({})
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Object URL cleanup (unmount only — per-removal handled in removeImage/resetAiState) ──
  const imageUrlsRef = useRef<string[]>([])
  useEffect(() => { imageUrlsRef.current = imageUrls }, [imageUrls])
  useEffect(() => { return () => { imageUrlsRef.current.forEach(URL.revokeObjectURL) } }, [])

  // ── Global paste listener for images ─────────────────────────────────────
  useEffect(() => {
    if (!open || activeTab !== 'ai' || aiInputType !== 'images' || parseStep !== 'input') return
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (files.length === 0) return
      const urls = files.map(URL.createObjectURL)
      setPastedImages((prev) => [...prev, ...files])
      setImageUrls((prev) => [...prev, ...urls])
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [open, activeTab, aiInputType, parseStep])

  // ── Reset helpers ─────────────────────────────────────────────────────────
  const resetAiState = useCallback(() => {
    setPastedImages([])
    imageUrls.forEach(URL.revokeObjectURL)
    setImageUrls([])
    setUploadedFile(null)
    setPastedText('')
    setParseStep('input')
    setParseResults([])
    setParseError(null)
    setConflictActions({})
    setImportResult(null)
    setBatchMode(false)
  }, [imageUrls])

  const handleClose = () => {
    setForm({
      full_name: '', current_title: '', current_company: '', location: '',
      years_experience: '', salary_range: '', education: '',
      phone: '', email: '', linkedin_url: '', liepin_url: '', experience_summary: '',
    })
    setManualError('')
    setActiveTab('ai')
    resetAiState()
    onClose()
  }

  // ── Manual form submit ────────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setManualError('姓名为必填项'); return }
    setManualLoading(true)
    setManualError('')
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
      setManualError('添加失败，请检查后端连接')
    } finally {
      setManualLoading(false)
    }
  }

  // ── AI parse ──────────────────────────────────────────────────────────────
  const handleParse = async () => {
    setParseStep('parsing')
    setParseError(null)
    try {
      let response
      if (aiInputType === 'images') {
        if (pastedImages.length === 0) {
          setParseError('请先粘贴或拖入至少一张截图')
          setParseStep('input')
          return
        }
        response = await talentApi.parseImages(pastedImages, batchMode)
      } else if (aiInputType === 'file') {
        if (!uploadedFile) {
          setParseError('请先选择文件')
          setParseStep('input')
          return
        }
        response = await talentApi.parseDocument(uploadedFile)
      } else {
        if (!pastedText.trim()) {
          setParseError('请先粘贴文字内容')
          setParseStep('input')
          return
        }
        response = await talentApi.parseText(pastedText)
      }

      if (response.error) {
        setParseError(response.error)
        setParseStep('input')
        return
      }
      if (response.results.length === 0) {
        setParseError('未能从内容中提取到候选人信息，请检查内容后重试')
        setParseStep('input')
        return
      }

      // Default conflict actions: skip if conflict exists, otherwise create
      const defaults: typeof conflictActions = {}
      response.results.forEach((r, i) => {
        if (r.conflicts.length > 0) {
          defaults[i] = { action: 'skip', existing_id: r.conflicts[0].existing_candidate.id }
        } else {
          defaults[i] = { action: 'create' }
        }
      })
      setConflictActions(defaults)
      setParseResults(response.results)
      setParseStep('preview')
    } catch (err) {
      setParseError(`请求失败：${err}`)
      setParseStep('input')
    }
  }

  // ── AI confirm import ─────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    setParseStep('importing')
    const platform = sourcePlatformOf(aiInputType, fileType)
    const candidates: ConfirmCandidateItem[] = parseResults.map((r, i) => ({
      parsed_data: r.parsed_data,
      action: conflictActions[i]?.action ?? 'create',
      existing_id: conflictActions[i]?.existing_id,
      source_platform: platform,
    }))
    try {
      const result = await talentApi.confirmImport({ candidates })
      setImportResult(result)
      await fetchCandidates()
    } catch (err) {
      setParseError(`导入失败：${err}`)
      setParseStep('preview')
    }
  }

  // ── Image drag-drop ───────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    const urls = files.map(URL.createObjectURL)
    setPastedImages((prev) => [...prev, ...files])
    setImageUrls((prev) => [...prev, ...urls])
  }

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imageUrls[idx])
    setPastedImages((prev) => prev.filter((_, i) => i !== idx))
    setImageUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadedFile(f)
    setFileType(f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'word')
  }

  // ── Conflict action setter ────────────────────────────────────────────────
  const setAction = (
    idx: number,
    action: 'create' | 'skip' | 'overwrite',
    conflict?: DuplicateConflict,
  ) => {
    setConflictActions((prev) => ({
      ...prev,
      [idx]: { action, existing_id: conflict?.existing_candidate.id },
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-base">添加候选人</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-container-low rounded-lg shrink-0">
          {(['ai', 'manual'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === tab
                  ? 'bg-white shadow text-on-surface'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {tab === 'manual' ? '手动填写' : 'AI 解析'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          {/* ── Manual tab ── */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 pt-2">
              <div>
                <Label>姓名 <span className="text-red-500 normal-case font-normal">*</span></Label>
                <input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="张三" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>当前职位</Label><input value={form.current_title} onChange={(e) => setForm(f => ({ ...f, current_title: e.target.value }))} placeholder="高级工程师" className={inputClass} /></div>
                <div><Label>当前公司</Label><input value={form.current_company} onChange={(e) => setForm(f => ({ ...f, current_company: e.target.value }))} placeholder="某科技有限公司" className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>地点</Label><input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="上海" className={inputClass} /></div>
                <div><Label>工作年限</Label><input type="number" min={0} value={form.years_experience} onChange={(e) => setForm(f => ({ ...f, years_experience: e.target.value }))} placeholder="8" className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>薪资范围</Label><input value={form.salary_range} onChange={(e) => setForm(f => ({ ...f, salary_range: e.target.value }))} placeholder="30-50k" className={inputClass} /></div>
                <div><Label>教育背景</Label><input value={form.education} onChange={(e) => setForm(f => ({ ...f, education: e.target.value }))} placeholder="清华大学 · 计算机硕士" className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>手机号</Label><input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="138 0000 0000" className={inputClass} /></div>
                <div><Label>邮箱</Label><input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@company.com" className={inputClass} /></div>
              </div>
              <div>
                <Label>经历摘要</Label>
                <textarea value={form.experience_summary} onChange={(e) => setForm(f => ({ ...f, experience_summary: e.target.value }))} placeholder="曾负责核心支付系统架构设计，带领 10 人团队完成日均亿级流量平台建设..." rows={3} className={`${inputClass} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>LinkedIn URL</Label><input value={form.linkedin_url} onChange={(e) => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." className={`${inputClass} font-mono text-xs`} /></div>
                <div><Label>猎聘 URL</Label><input value={form.liepin_url} onChange={(e) => setForm(f => ({ ...f, liepin_url: e.target.value }))} placeholder="https://www.liepin.com/resume/..." className={`${inputClass} font-mono text-xs`} /></div>
              </div>
              {manualError && <p className="text-sm text-red-600">{manualError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors">取消</button>
                <button type="submit" disabled={manualLoading} className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active disabled:opacity-50">
                  {manualLoading ? '添加中...' : '添加候选人'}
                </button>
              </div>
            </form>
          )}

          {/* ── AI tab ── */}
          {activeTab === 'ai' && (
            <div className="pt-2 space-y-4">

              {/* Input type selector (hidden during parse/import) */}
              {parseStep === 'input' && (
                <>
                  <div className="flex gap-2">
                    {([
                      { key: 'images', icon: Image, label: '图片截图' },
                      { key: 'file', icon: FileText, label: '上传文件' },
                      { key: 'text', icon: Type, label: '粘贴文字' },
                    ] as const).map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setAiInputType(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                          aiInputType === key
                            ? 'bg-primary/5 border-primary/30 text-primary'
                            : 'border-outline-variant/20 text-secondary hover:text-on-surface'
                        }`}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Images mode */}
                  {aiInputType === 'images' && (
                    <div className="space-y-3">
                      <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className={`min-h-32 rounded-xl border-2 border-dashed transition-colors p-4 ${
                          pastedImages.length > 0
                            ? 'border-primary/30 bg-primary/[0.02]'
                            : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/20'
                        }`}
                      >
                        {pastedImages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 text-center">
                            <Image size={24} className="text-secondary/40 mb-2" />
                            <p className="text-sm text-secondary">按 Ctrl+V 粘贴截图，或拖拽图片到此处</p>
                            <p className="text-[11px] text-secondary/60 mt-1">支持 PNG / JPG / WebP，单张最大 20 MB</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {pastedImages.map((_, idx) => (
                              <div key={idx} className="relative group aspect-square">
                                <img
                                  src={imageUrls[idx]}
                                  alt={`截图 ${idx + 1}`}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                  onClick={() => removeImage(idx)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={batchMode}
                          onChange={(e) => setBatchMode(e.target.checked)}
                          className="rounded accent-primary"
                        />
                        <span className="text-xs text-secondary">
                          批量模式（每张截图为不同候选人）
                        </span>
                      </label>
                    </div>
                  )}

                  {/* File mode */}
                  {aiInputType === 'file' && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-32 rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low hover:border-primary/20 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 p-4"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <FileText size={24} className="text-secondary/40" />
                      {uploadedFile ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-on-surface">{uploadedFile.name}</p>
                          <p className="text-[11px] text-secondary mt-0.5">点击重新选择</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-secondary">点击选择 PDF 或 Word 文件</p>
                          <p className="text-[11px] text-secondary/60 mt-1">支持 .pdf / .doc / .docx</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text mode */}
                  {aiInputType === 'text' && (
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="将候选人简历文字粘贴到此处..."
                      rows={8}
                      className={`${inputClass} resize-none`}
                    />
                  )}

                  {parseError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{parseError}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors">取消</button>
                    <button
                      onClick={handleParse}
                      className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active"
                    >
                      开始解析
                    </button>
                  </div>
                </>
              )}

              {/* Parsing spinner */}
              {parseStep === 'parsing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={32} className="text-primary animate-spin" />
                  <p className="text-sm text-secondary">AI 正在解析候选人信息...</p>
                </div>
              )}

              {/* Preview */}
              {parseStep === 'preview' && (
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-secondary">
                    解析结果 · {parseResults.length} 位候选人
                  </p>

                  {parseResults.map((result, idx) => {
                    const pd = result.parsed_data
                    const conflict = result.conflicts[0] as DuplicateConflict | undefined
                    const action = conflictActions[idx]?.action ?? 'create'
                    const completeness = completenessOf(pd)

                    return (
                      <div key={idx} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-on-surface">
                              {pd.full_name ?? <span className="text-red-400 italic">姓名未识别</span>}
                            </p>
                            <p className="text-[11px] text-secondary">
                              {[pd.current_title, pd.current_company].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          {/* Completeness badge */}
                          <div className="shrink-0 text-right">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              completeness >= 70
                                ? 'bg-emerald-100 text-emerald-700'
                                : completeness >= 40
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-600'
                            }`}>
                              完整度 {completeness}%
                            </span>
                          </div>
                        </div>

                        {/* Fields grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          {[
                            ['地点', pd.location],
                            ['工作年限', pd.years_experience != null ? `${pd.years_experience} 年` : null],
                            ['手机', pd.phone],
                            ['邮箱', pd.email],
                            ['教育', pd.education],
                            ['薪资', pd.salary_range],
                          ].map(([label, value]) => (
                            <div key={label as string} className="flex gap-1">
                              <span className="text-secondary shrink-0">{label}：</span>
                              <span className={`text-on-surface truncate ${!value ? 'text-secondary/40 italic' : ''}`}>
                                {value ?? '未识别'}
                              </span>
                            </div>
                          ))}
                        </div>

                        {pd.experience_summary && (
                          <p className="text-[11px] text-secondary leading-relaxed border-t border-outline-variant/10 pt-2">
                            {pd.experience_summary}
                          </p>
                        )}

                        {/* Conflict warning */}
                        {conflict && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                              <p className="text-xs font-bold text-amber-700">
                                发现重复候选人 · {conflictLabel[conflict.match_reason]}
                              </p>
                            </div>
                            <p className="text-[11px] text-amber-700 pl-5">
                              现有记录：{conflict.existing_candidate.full_name}
                              {conflict.existing_candidate.current_company
                                ? ` · ${conflict.existing_candidate.current_company}`
                                : ''}
                            </p>
                            {/* Action selector */}
                            <div className="flex gap-2 pl-5">
                              {(['skip', 'overwrite', 'create'] as const).map((a) => (
                                <button
                                  key={a}
                                  onClick={() => setAction(idx, a, conflict)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                    action === a
                                      ? 'bg-amber-600 border-amber-600 text-white'
                                      : 'border-amber-300 text-amber-700 hover:bg-amber-100'
                                  }`}
                                >
                                  {a === 'skip' ? '跳过' : a === 'overwrite' ? '覆盖更新' : '仍然新建'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No-conflict skip option */}
                        {!conflict && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-secondary">操作：</span>
                            {(['create', 'skip'] as const).map((a) => (
                              <button
                                key={a}
                                onClick={() => setAction(idx, a)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                  action === a
                                    ? 'bg-primary border-primary text-white'
                                    : 'border-outline-variant/30 text-secondary hover:text-on-surface'
                                }`}
                              >
                                {a === 'create' ? '导入' : '跳过'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {parseError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{parseError}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={() => { setParseStep('input'); setParseError(null) }}
                      className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-on-surface transition-colors"
                    >
                      重新解析
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all scale-98-active"
                    >
                      确认导入
                    </button>
                  </div>
                </div>
              )}

              {/* Importing spinner */}
              {parseStep === 'importing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={32} className="text-primary animate-spin" />
                  <p className="text-sm text-secondary">正在写入人才库...</p>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                  <div className="text-center">
                    <p className="font-headline font-black text-base text-on-surface">导入完成</p>
                    <p className="text-sm text-secondary mt-1">
                      新增 {importResult.created} 人 · 更新 {importResult.updated} 人 · 跳过 {importResult.skipped} 人
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-lg kinetic-gradient text-white text-sm font-headline font-semibold hover:shadow-md transition-all"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
