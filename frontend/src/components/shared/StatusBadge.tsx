type BadgeVariant = 'project' | 'candidate'

const projectColors: Record<string, string> = {
  active: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-zinc-100 text-zinc-500',
}

const candidateColors: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-500',
  recommended: 'bg-green-100 text-green-700',
  eliminated: 'bg-red-100 text-red-600',
  interviewed: 'bg-blue-100 text-blue-700',
}

const projectLabels: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const candidateLabels: Record<string, string> = {
  pending: '待评估',
  recommended: '已推荐',
  eliminated: '已淘汰',
  interviewed: '已面试',
}

interface StatusBadgeProps {
  status: string
  variant?: BadgeVariant
}

export default function StatusBadge({ status, variant = 'project' }: StatusBadgeProps) {
  const colors = variant === 'project' ? projectColors : candidateColors
  const labels = variant === 'project' ? projectLabels : candidateLabels
  const colorClass = colors[status] ?? 'bg-zinc-100 text-zinc-500'
  const label = labels[status] ?? status

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${colorClass}`}>
      {label}
    </span>
  )
}
