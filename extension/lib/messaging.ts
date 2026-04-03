import type { MessageRequest, MessageResponse } from './types';

// Typed message sender for content scripts
export function sendMessage<T = unknown>(
  msg: MessageRequest
): Promise<MessageResponse<T>> {
  return browser.runtime.sendMessage(msg) as Promise<MessageResponse<T>>;
}
