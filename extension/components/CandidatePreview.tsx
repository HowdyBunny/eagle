import type { CandidateData } from '../lib/types';

interface CandidatePreviewProps {
  data: CandidateData | null;
  error?: string;
}

export function CandidatePreview({ data, error }: CandidatePreviewProps) {
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

  return (
    <div className="rounded-xl bg-gradient-to-br from-eagle-card-start to-eagle-card-end px-3 py-2.5 space-y-1 border border-eagle-border">
      <p className="font-display text-sm font-bold text-eagle-gold truncate">{data.full_name}</p>
      {data.current_title && (
        <p className="text-xs text-eagle-ink truncate">{data.current_title}</p>
      )}
      {data.current_company && (
        <p className="text-xs text-eagle-ink/60 truncate">@ {data.current_company}</p>
      )}
      {data.location && (
        <p className="text-xs text-eagle-gold/70 truncate">📍 {data.location}</p>
      )}
      <p className="text-xs text-eagle-gold font-medium pt-0.5">
        {data.source_platform === 'linkedin' ? 'LinkedIn' : '猎聘'}
      </p>
    </div>
  );
}
