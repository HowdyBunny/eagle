import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: inject X-API-Key (backend auth) from localStorage.
// We also forward LLM/Embedding overrides as headers so the backend can
// optionally honor per-request credentials (see README §Backend Contract).
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('eagle-app-store')
  if (!raw) return config
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
    const s = parsed?.state ?? {}
    const get = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : '')

    const auth = get('authApiKey')
    if (auth) config.headers['X-API-Key'] = auth
  } catch {
    // ignore parse errors
  }
  return config
})
