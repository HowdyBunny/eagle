// Chrome storage wrappers for extension settings

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get('apiUrl');
  return result.apiUrl ?? 'http://localhost:8000';
}

export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ apiUrl: url });
}

export async function getApiKey(): Promise<string> {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey ?? '';
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ apiKey: key });
}

export async function getSettings(): Promise<{ apiUrl: string; apiKey: string }> {
  const result = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  return {
    apiUrl: result.apiUrl ?? 'http://localhost:8000',
    apiKey: result.apiKey ?? '',
  };
}
