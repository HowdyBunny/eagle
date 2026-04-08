interface EvaluationResultProps {
  matchScore: number | null;
  status: string;
  pollCount?: number;
  error?: string | null;
  onRetry?: () => void;
}

export function EvaluationResult({ matchScore, status, pollCount, error, onRetry }: EvaluationResultProps) {
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 space-y-2">
        <p className="text-xs font-medium text-red-700">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (matchScore === null) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-eagle-card-start to-eagle-card-end border border-eagle-border px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-eagle-gold animate-pulse" />
          <span className="text-xs font-medium text-eagle-primary">AI 评估中</span>
        </div>
        {pollCount !== undefined && (
          <p className="text-xs text-eagle-ink/50">已等待 {pollCount * 5} 秒...</p>
        )}
      </div>
    );
  }

  const score = Math.round(matchScore * 10) / 10;
  const isGood = score >= 70;
  const isMedium = score >= 50 && score < 70;

  const colorClass = isGood
    ? 'bg-emerald-50 border-emerald-200'
    : isMedium
    ? 'bg-gradient-to-br from-eagle-card-start to-eagle-card-end border-eagle-border'
    : 'bg-red-50 border-red-200';

  const scoreColor = isGood
    ? 'text-emerald-700'
    : isMedium
    ? 'text-eagle-gold'
    : 'text-red-700';

  const statusLabel =
    status === 'recommended'
      ? '推荐'
      : status === 'eliminated'
      ? '不推荐'
      : status === 'interviewed'
      ? '已面试'
      : '待定';

  return (
    <div className={`rounded-xl border px-3 py-2 space-y-1 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-eagle-ink/70">匹配度</span>
        <span className={`text-lg font-display font-bold ${scoreColor}`}>{score}%</span>
      </div>
      <div className="w-full bg-eagle-border rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isGood ? 'bg-emerald-500' : isMedium ? 'bg-eagle-gold' : 'bg-red-400'}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <p className="text-xs text-eagle-ink/50">AI 判断：{statusLabel}</p>
    </div>
  );
}
