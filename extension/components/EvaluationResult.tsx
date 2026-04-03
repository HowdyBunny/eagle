interface EvaluationResultProps {
  matchScore: number | null;
  status: string;
  pollCount?: number;
}

export function EvaluationResult({ matchScore, status, pollCount }: EvaluationResultProps) {
  if (matchScore === null) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-amber-700">AI 评估中</span>
        </div>
        {pollCount !== undefined && (
          <p className="text-xs text-amber-600">已等待 {pollCount * 5} 秒...</p>
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
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200';

  const scoreColor = isGood
    ? 'text-emerald-700'
    : isMedium
    ? 'text-amber-700'
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
    <div className={`rounded-md border px-3 py-2 space-y-1 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">匹配度</span>
        <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isGood ? 'bg-emerald-500' : isMedium ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">AI 判断：{statusLabel}</p>
    </div>
  );
}
