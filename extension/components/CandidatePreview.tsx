import type { CandidateData } from '../lib/types';

interface CandidatePreviewProps {
  data: CandidateData | null;
  error?: string;
  onRetry?: () => void;
}

export function CandidatePreview({ data, error, onRetry }: CandidatePreviewProps) {
  if (error) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-md bg-eagle-surface px-3 py-2 text-xs text-eagle-ink/50 border border-eagle-border">
        正在解析页面...
      </div>
    );
  }

  const isUnknown = data.full_name === 'Unknown' || (
    !data.current_title && !data.current_company && !data.location
  );

  return (
    <div className="rounded-xl bg-gradient-to-br from-eagle-card-start to-eagle-card-end px-3 py-2.5 space-y-1 border border-eagle-border">
      <div className="flex items-center justify-between gap-1">
        <p className="font-display text-sm font-bold text-eagle-gold truncate">{data.full_name}</p>
        {isUnknown && onRetry && (
          <button
            onClick={onRetry}
            title="页面可能未完全加载，点击重新解析"
            className="flex-shrink-0 rounded p-0.5 text-eagle-gold/60 hover:text-eagle-gold hover:bg-white/40 transition-colors"
          >
            <RetryIcon />
          </button>
        )}
      </div>
      {data.current_title && (
        <p className="text-xs text-eagle-ink truncate">{data.current_title}</p>
      )}
      {data.current_company && (
        <p className="text-xs text-eagle-ink/60 truncate">@ {data.current_company}</p>
      )}
      {data.location && (
        <p className="text-xs text-eagle-gold/70 truncate">📍 {data.location}</p>
      )}
      {isUnknown && (
        <p className="text-xs text-amber-600/80">页面未完全加载，可点击 ↻ 重新解析</p>
      )}
      <p className="text-xs text-eagle-gold font-medium pt-0.5">
        {data.source_platform === 'linkedin' ? 'LinkedIn' : '猎聘'}
      </p>
    </div>
  );
}

function RetryIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 7a5 5 0 1 1 1.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 10.5V7h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
