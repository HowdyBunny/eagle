import axios from 'axios'

// The backend runs on a fixed loopback port in both dev and the packaged
// Tauri app (see backend/main.py). CORS is wide-open on the FastAPI side.
const API_BASE_URL = 'http://127.0.0.1:52777/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

