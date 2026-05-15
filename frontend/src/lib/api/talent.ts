import { apiClient } from '../api-client'
import type {
  ConfirmImportRequest,
  ConfirmImportResponse,
  ParseResponse,
} from '@/types/talent'

export async function parseImages(
  files: File[],
  batchMode: boolean,
): Promise<ParseResponse> {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  formData.append('batch_mode', String(batchMode))
  // Omit Content-Type so axios sets multipart/form-data with the correct boundary
  const { data } = await apiClient.post<ParseResponse>('/talent/parse-images', formData, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

export async function parseDocument(file: File): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<ParseResponse>('/talent/parse-document', formData, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

export async function parseText(text: string): Promise<ParseResponse> {
  const { data } = await apiClient.post<ParseResponse>('/talent/parse-text', { text })
  return data
}

export async function confirmImport(
  request: ConfirmImportRequest,
): Promise<ConfirmImportResponse> {
  const { data } = await apiClient.post<ConfirmImportResponse>(
    '/talent/confirm-import',
    request,
  )
  return data
}

export async function extractDoc(file: File): Promise<{ text: string; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<{ text: string; filename: string }>(
    '/talent/extract-doc',
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}
