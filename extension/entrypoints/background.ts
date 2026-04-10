import type {
  MessageRequest,
  MessageResponse,
  Project,
  Candidate,
  EvaluationStatus,
} from '../lib/types';
import { getSettings } from '../lib/storage';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true; // Keep channel open for async response
    }
  );
});

async function handleMessage(msg: MessageRequest): Promise<MessageResponse> {
  try {
    const { apiUrl } = await getSettings();

    switch (msg.type) {
      case 'TEST_CONNECTION': {
        const res = await fetch(`${apiUrl}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { success: true, data };
      }

      case 'FETCH_PROJECTS': {
        const data = await apiFetch<Project[]>(
          `${apiUrl}/api/projects?limit=100`,
          { method: 'GET' }
        );
        return { success: true, data };
      }

      case 'SUBMIT_CANDIDATE': {
        const data = await apiFetch<Candidate>(
          `${apiUrl}/api/candidates`,
          { method: 'POST', body: JSON.stringify(msg.payload) }
        );
        return { success: true, data };
      }

      case 'TRIGGER_EVALUATION': {
        const { projectId, candidateId } = msg.payload;
        const data = await apiFetch(
          `${apiUrl}/api/projects/${projectId}/evaluate/${candidateId}`,
          { method: 'POST' }
        );
        return { success: true, data };
      }

      case 'POLL_EVALUATION': {
        const { projectId, candidateId } = msg.payload;
        const data = await apiFetch<EvaluationStatus>(
          `${apiUrl}/api/projects/${projectId}/candidates/${candidateId}/status`,
          { method: 'GET' }
        );
        return { success: true, data };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (err) {
    return { success: false, error: formatError(err) };
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) throw new Error('Unauthorized.');
  if (res.status === 404) throw new Error('Resource not found.');
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Validation error: ${JSON.stringify(body?.detail ?? body)}`);
  }
  if (!res.ok) {
    throw new Error(`Server error (HTTP ${res.status}). Try again later.`);
  }

  // 202 responses may have no body or a simple message
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function formatError(err: unknown): string {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Cannot connect to backend. Is the server running?';
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error occurred.';
}
