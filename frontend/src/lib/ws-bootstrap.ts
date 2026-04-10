/**
 * WebSocket client for the project bootstrap flow.
 *
 * Replaces the REST sequence (POST /projects → POST /chat) with a single
 * WebSocket connection that streams structured metadata events, giving
 * real-time feedback during project creation + first CA response.
 *
 * Server → client event types:
 *   status          — transient progress indicator (e.g. "正在创建项目…")
 *   project_created — stub project created (ProjectResponse)
 *   project_updated — CA updated project metadata (ProjectResponse)
 *   tool_call       — CA invoked a tool
 *   ca_reply        — final CA text response
 *   done            — stream complete
 *   error           — something went wrong
 */

import type { ProjectResponse } from '@/types'

export interface BootstrapEvent {
  type:
    | 'status'
    | 'project_created'
    | 'project_updated'
    | 'tool_call'
    | 'text'
    | 'ca_reply'
    | 'done'
    | 'error'
  // status / error
  message?: string
  // project_created / project_updated
  project?: ProjectResponse
  // tool_call
  tool?: string
  args?: string[]
  // text delta
  delta?: string
  // ca_reply
  content?: string
  actions_taken?: string[]
  intent_json?: Record<string, unknown> | null
}

export type BootstrapEventHandler = (event: BootstrapEvent) => void

/**
 * Open a WebSocket to /api/projects/bootstrap, send the initial message,
 * and stream events to the handler. Returns a cleanup function.
 */
export function bootstrapProject(
  message: string,
  mode: 'precise' | 'explore' = 'precise',
  onEvent: BootstrapEventHandler,
): () => void {
  // Build WS URL relative to current page
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${proto}//${location.host}/api/projects/bootstrap`

  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(JSON.stringify({ message, mode }))
  }

  ws.onmessage = (e) => {
    try {
      const event: BootstrapEvent = JSON.parse(e.data)
      onEvent(event)
    } catch {
      onEvent({ type: 'error', message: '无法解析服务器消息' })
    }
  }

  ws.onerror = () => {
    onEvent({ type: 'error', message: 'WebSocket 连接失败' })
  }

  ws.onclose = (e) => {
    if (e.code !== 1000) {
      onEvent({ type: 'error', message: `连接断开 (${e.code})` })
    }
  }

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  }
}
