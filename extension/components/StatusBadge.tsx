type Status = 'idle' | 'loading' | 'success' | 'error' | 'evaluating' | 'evaluated';

interface StatusBadgeProps {
  status: Status;
  message?: string;
}

const config: Record<Status, { dot: string; text: string; label: string }> = {
  idle: { dot: 'bg-gray-400', text: 'text-gray-600', label: '待采集' },
  loading: { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-600', label: '提交中...' },
  success: { dot: 'bg-green-500', text: 'text-green-700', label: '采集成功' },
  error: { dot: 'bg-red-500', text: 'text-red-700', label: '出错了' },
  evaluating: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-700', label: '评估中...' },
  evaluated: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: '评估完成' },
};

export function StatusBadge({ status, message }: StatusBadgeProps) {
  const c = config[status];
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${c.dot}`} />
      <span className={`text-xs font-medium ${c.text}`}>
        {message || c.label}
      </span>
    </div>
  );
}
