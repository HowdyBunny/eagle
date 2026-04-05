interface MatchDonutProps {
  score: number
  size?: number
  label?: string
}

export default function MatchDonut({ score, size = 64, label }: MatchDonutProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(score, 100) / 100)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-zinc-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="font-headline font-black text-xs text-on-surface rotate-0">{Math.round(score)}%</span>
      </div>
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{label}</span>}
    </div>
  )
}
