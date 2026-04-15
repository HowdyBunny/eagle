import { apiClient } from '../api-client'

interface ClientError {
  message: string
  source?: string
  stack?: string
  context?: string
}

// Fire-and-forget — never throws, never blocks the UI
export function reportError(payload: ClientError): void {
  apiClient.post('/errors', payload).catch(() => {/* backend unreachable, silently ignore */})
}
