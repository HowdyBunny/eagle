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
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500 border border-gray-200">
        正在解析页面...
      </div>
    );
  }

  return (
    <div className="rounded-md bg-blue-50 px-3 py-2 space-y-1 border border-blue-200">
      <p className="text-sm font-semibold text-gray-900 truncate">{data.full_name}</p>
      {data.current_title && (
        <p className="text-xs text-gray-600 truncate">{data.current_title}</p>
      )}
      {data.current_company && (
        <p className="text-xs text-gray-500 truncate">@ {data.current_company}</p>
      )}
      {data.location && (
        <p className="text-xs text-gray-400 truncate">📍 {data.location}</p>
      )}
      <p className="text-xs text-blue-500 font-medium pt-0.5">
        {data.source_platform === 'linkedin' ? 'LinkedIn' : '猎聘'}
      </p>
    </div>
  );
}
