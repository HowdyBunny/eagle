import { create } from 'zustand'
import type { ProjectResponse, ProjectCreate, ProjectUpdate } from '@/types'
import * as projectsApi from '@/lib/api/projects'

interface ProjectState {
  projects: ProjectResponse[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  createProject: (body: ProjectCreate) => Promise<ProjectResponse>
  updateProject: (id: string, body: ProjectUpdate) => Promise<ProjectResponse>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await projectsApi.listProjects()
      set({ projects, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createProject: async (body) => {
    const project = await projectsApi.createProject(body)
    set({ projects: [project, ...get().projects] })
    return project
  },

  updateProject: async (id, body) => {
    const updated = await projectsApi.updateProject(id, body)
    set({
      projects: get().projects.map((p) => (p.id === id ? updated : p)),
    })
    return updated
  },
}))
