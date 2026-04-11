// Chrome storage wrappers for extension settings

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get('apiUrl');
  return result.apiUrl ?? 'http://localhost:52777';
}

export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ apiUrl: url });
}

export async function getSettings(): Promise<{ apiUrl: string }> {
  const result = await chrome.storage.local.get('apiUrl');
  return {
    apiUrl: result.apiUrl ?? 'http://localhost:52777',
  };
}
