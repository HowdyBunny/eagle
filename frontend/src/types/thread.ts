export interface ThreadCreate {
  name?: string
}

export interface ThreadRename {
  name: string
}

export interface ThreadResponse {
  id: string | null   // null = legacy "初始对话" pseudo-thread
  project_id: string
  name: string
  created_at: string
  is_legacy?: boolean
}
