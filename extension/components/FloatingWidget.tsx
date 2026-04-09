import { useState, useEffect, useCallback } from 'react';
const eagleIconUrl = browser.runtime.getURL('/icon/32.png');
import type { CandidateData, Candidate, EvaluationStatus, Project } from '../lib/types';
import { extractCandidateData, waitForProfile } from '../lib/parsers/index';
import { sendMessage } from '../lib/messaging';
import { CandidatePreview } from './CandidatePreview';
import { ProjectSelector } from './ProjectSelector';
import { StatusBadge } from './StatusBadge';
import { EvaluationResult } from './EvaluationResult';

type WidgetState =
  | 'idle'
  | 'collecting'
  | 'collected'
  | 'evaluating'
  | 'evaluated'
  | 'error';

const MAX_POLL = 36; // 3 minutes at 5s interval

export function FloatingWidget() {
  const [minimized, setMinimized] = useState(false);
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [parseError, setParseError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [autoEvaluate, setAutoEvaluate] = useState(true);
  const [collectedCandidate, setCollectedCandidate] = useState<Candidate | null>(null);
  const [evalStatus, setEvalStatus] = useState<EvaluationStatus | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Wait for the full profile DOM to load, then extract for the preview.
  useEffect(() => {
    let cancelled = false;
    waitForProfile().then(() => {
      if (cancelled) return;
      try {
        const data = extractCandidateData();
        setCandidateData(data);
      } catch (e) {
        setParseError(e instanceof Error ? e.message : '页面解析失败');
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleCollect = async () => {
    setWidgetState('collecting');
    setErrorMessage('');

    // Re-extract at click time so lazy-loaded sections (experience, education)
    // are in the DOM — LinkedIn only renders them after the user scrolls down.
    let payload = candidateData;
    try {
      payload = extractCandidateData();
      setCandidateData(payload);
      setParseError(undefined);
    } catch (e) {
      // If re-extraction fails, fall back to the preview data
    }

    if (!payload) {
      setWidgetState('error');
      setErrorMessage('无法读取页面数据');
      return;
    }

    const res = await sendMessage<Candidate>({
      type: 'SUBMIT_CANDIDATE',
      payload,
    });

    if (!res.success) {
      setWidgetState('error');
      setErrorMessage(res.error);
      return;
    }

    const candidate = res.data;
    setCollectedCandidate(candidate);
    setWidgetState('collected');

    // Trigger evaluation if project is selected and auto-evaluate is on
    if (autoEvaluate && selectedProject) {
      await triggerEvaluation(selectedProject.id, candidate.id);
    }
  };

  const triggerEvaluation = async (projectId: string, candidateId: string) => {
    const evalRes = await sendMessage({
      type: 'TRIGGER_EVALUATION',
      payload: { projectId, candidateId },
    });

    if (!evalRes.success) {
      // Evaluation trigger failed - not fatal, candidate was still saved
      return;
    }

    setWidgetState('evaluating');
    setPollCount(0);
    pollEvaluation(projectId, candidateId, 0);
  };

  const pollEvaluation = useCallback(
    async (projectId: string, candidateId: string, count: number) => {
      if (count >= MAX_POLL) {
        setWidgetState('evaluated');
        setEvalError('任务超时，请重试');
        return;
      }

      await new Promise((r) => setTimeout(r, 5000));
      setPollCount(count + 1);

      const res = await sendMessage<EvaluationStatus>({
        type: 'POLL_EVALUATION',
        payload: { projectId, candidateId },
      });

      if (!res.success) {
        setWidgetState('evaluated'); // stop polling on error
        return;
      }

      setEvalStatus(res.data);

      if (res.data.status === 'failed') {
        setWidgetState('evaluated');
        setEvalError(res.data.error_message ?? '评估任务失败，请重试');
        return;
      }

      if (res.data.is_complete) {
        setWidgetState('evaluated');
      } else {
        pollEvaluation(projectId, candidateId, count + 1);
      }
    },
    []
  );

  const handleReset = () => {
    setWidgetState('idle');
    setCollectedCandidate(null);
    setEvalStatus(null);
    setPollCount(0);
    setErrorMessage('');
    setEvalError(null);
    // Re-parse candidate data
    try {
      const data = extractCandidateData();
      setCandidateData(data);
      setParseError(undefined);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '页面解析失败');
    }
  };

  const isCollecting = widgetState === 'collecting';
  const isDone = widgetState === 'collected' || widgetState === 'evaluating' || widgetState === 'evaluated';

  // --- Minimized view ---
  if (minimized) {
    return (
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[999999]">
        <button
          onClick={() => setMinimized(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-eagle-gold shadow-lg hover:bg-eagle-primary transition-colors"
          title="展开 Eagle 插件"
        >
          <EagleLogo />
        </button>
      </div>
    );
  }

  // --- Full view ---
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[999999] w-72 rounded-xl border border-eagle-border bg-white shadow-2xl overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-eagle-border/60 px-3 py-2.5 bg-white">
        <div className="flex items-center gap-2">
          <EagleLogo small />
          <span className="font-display text-sm font-bold text-eagle-primary tracking-tight">Eagle</span>
          <span className="text-xs text-eagle-gold font-medium">猎头助手</span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="rounded p-0.5 text-eagle-gold/60 hover:text-eagle-gold hover:bg-eagle-card-end transition-colors"
          title="最小化"
        >
          <MinimizeIcon />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Candidate Preview */}
        <CandidatePreview data={candidateData} error={parseError} />

        {/* Status */}
        {widgetState === 'error' && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Collected info */}
        {collectedCandidate && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-1.5">
            <StatusBadge status="success" message="候选人已保存至数据库" />
          </div>
        )}

        {/* Evaluation result */}
        {(widgetState === 'evaluating' || widgetState === 'evaluated') && (
          <EvaluationResult
            matchScore={evalStatus?.match_score ?? null}
            status={evalStatus?.status ?? ''}
            pollCount={pollCount}
            error={evalError}
            onRetry={evalError && collectedCandidate && selectedProject
              ? () => {
                  setEvalError(null);
                  setEvalStatus(null);
                  triggerEvaluation(selectedProject.id, collectedCandidate.id);
                }
              : undefined
            }
          />
        )}

        {/* Project Selector & options - only when not done collecting */}
        {!isDone && !parseError && (
          <>
            <ProjectSelector
              selectedId={selectedProject?.id ?? null}
              onSelect={setSelectedProject}
            />

            {selectedProject && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEvaluate}
                  onChange={(e) => setAutoEvaluate(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-eagle-border text-eagle-gold focus:ring-eagle-gold"
                />
                <span className="text-xs text-eagle-ink/70">采集后自动 AI 评估</span>
              </label>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="pt-1 space-y-2">
          {!isDone ? (
            <button
              onClick={handleCollect}
              disabled={isCollecting || !candidateData || !!parseError}
              className="w-full rounded-lg bg-gradient-to-br from-[#d4b344] to-[#b8921c] px-4 py-2 text-sm font-semibold text-white shadow-sm
                hover:from-[#c5a028] hover:to-[#a38014] active:scale-[0.98]
                disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                transition-all"
            >
              {isCollecting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  提交中...
                </span>
              ) : (
                '采集候选人'
              )}
            </button>
          ) : (
            <div className="space-y-2">
              {/* Manually trigger evaluation if not auto */}
              {widgetState === 'collected' && selectedProject && !autoEvaluate && collectedCandidate && (
                <button
                  onClick={() => triggerEvaluation(selectedProject.id, collectedCandidate.id)}
                  className="w-full rounded-lg bg-gradient-to-br from-[#d4b344] to-[#b8921c] px-4 py-2 text-sm font-semibold text-white hover:from-[#c5a028] hover:to-[#a38014] transition-all"
                >
                  触发 AI 评估
                </button>
              )}
              <button
                onClick={handleReset}
                className="w-full rounded-lg border border-eagle-border px-4 py-1.5 text-xs text-eagle-ink/60 hover:bg-eagle-card-end transition-colors"
              >
                重置
              </button>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="border-t border-eagle-border/60 pt-2">
          <StatusBadge
            status={
              widgetState === 'idle' ? 'idle'
              : widgetState === 'collecting' ? 'loading'
              : widgetState === 'collected' ? 'success'
              : widgetState === 'evaluating' ? 'evaluating'
              : widgetState === 'evaluated' ? 'evaluated'
              : 'error'
            }
          />
        </div>
      </div>
    </div>
  );
}

// --- Icons ---
function EagleLogo({ small }: { small?: boolean }) {
  const size = small ? 22 : 26;
  return <img src={eagleIconUrl} width={size} height={size} style={{ objectFit: 'contain' }} alt="Eagle" />;
}

function MinimizeIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
