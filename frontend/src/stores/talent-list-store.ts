import { create } from 'zustand'
import type {
  TalentListCreate,
  TalentListDetailResponse,
  TalentListMemberResponse,
  TalentListMemberStatus,
  TalentListSummaryResponse,
  TalentListUpdate,
} from '@/types'
import * as listsApi from '@/lib/api/talentLists'

// Persisted in localStorage so the filter chip on the index page survives
// reloads. Decoupled from app-store because it's purely a per-tab UI preference.
export type ProjectFilter = 'all' | 'current' | 'unassigned'

const PROJECT_FILTER_KEY = 'eagle.talentLists.projectFilter'

function loadProjectFilter(): ProjectFilter {
  if (typeof window === 'undefined') return 'all'
  const raw = window.localStorage.getItem(PROJECT_FILTER_KEY)
  if (raw === 'current' || raw === 'unassigned' || raw === 'all') return raw
  return 'all'
}

function saveProjectFilter(f: ProjectFilter) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PROJECT_FILTER_KEY, f)
  }
}

interface TalentListState {
  lists: TalentListSummaryResponse[]
  currentList: TalentListDetailResponse | null
  loading: boolean
  loadingDetail: boolean
  error: string | null

  projectFilter: ProjectFilter
  setProjectFilter: (f: ProjectFilter) => void

  fetchLists: (params?: { projectId?: string | null }) => Promise<void>
  fetchList: (listId: string) => Promise<TalentListDetailResponse>
  createList: (body: TalentListCreate) => Promise<TalentListDetailResponse>
  updateList: (listId: string, body: TalentListUpdate) => Promise<TalentListDetailResponse>
  deleteList: (listId: string) => Promise<void>
  addMembers: (listId: string, candidateIds: string[]) => Promise<void>
  updateMemberStatus: (
    listId: string,
    candidateId: string,
    status: TalentListMemberStatus,
  ) => Promise<void>
  updateMemberNote: (
    listId: string,
    candidateId: string,
    note: string,
  ) => Promise<void>
  removeMember: (listId: string, candidateId: string) => Promise<void>
  promoteMemberToProject: (
    listId: string,
    candidateId: string,
    projectId: string,
  ) => Promise<void>
  clearCurrentList: () => void
}

export const useTalentListStore = create<TalentListState>((set, get) => ({
  lists: [],
  currentList: null,
  loading: false,
  loadingDetail: false,
  error: null,
  projectFilter: loadProjectFilter(),

  setProjectFilter: (f) => {
    saveProjectFilter(f)
    set({ projectFilter: f })
  },

  fetchLists: async (params) => {
    set({ loading: true, error: null })
    try {
      const { projectFilter } = get()
      const apiParams: { project_id?: string; unassigned?: boolean } = {}
      if (projectFilter === 'current' && params?.projectId) {
        apiParams.project_id = params.projectId
      } else if (projectFilter === 'unassigned') {
        apiParams.unassigned = true
      }
      const lists = await listsApi.listTalentLists(apiParams)
      set({ lists, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  fetchList: async (listId) => {
    set({ loadingDetail: true, error: null })
    try {
      const list = await listsApi.getTalentList(listId)
      set({ currentList: list, loadingDetail: false })
      return list
    } catch (e) {
      set({ error: String(e), loadingDetail: false })
      throw e
    }
  },

  createList: async (body) => {
    const created = await listsApi.createTalentList(body)
    set((s) => ({ lists: [summarize(created), ...s.lists] }))
    return created
  },

  updateList: async (listId, body) => {
    const updated = await listsApi.updateTalentList(listId, body)
    set((s) => ({
      lists: s.lists.map((l) => (l.id === listId ? summarize(updated) : l)),
      currentList: s.currentList?.id === listId ? updated : s.currentList,
    }))
    return updated
  },

  deleteList: async (listId) => {
    await listsApi.deleteTalentList(listId)
    set((s) => ({
      lists: s.lists.filter((l) => l.id !== listId),
      currentList: s.currentList?.id === listId ? null : s.currentList,
    }))
  },

  addMembers: async (listId, candidateIds) => {
    await listsApi.addTalentListMembers(listId, candidateIds)
    // Refetch the detail to pick up the new members with candidate data.
    if (get().currentList?.id === listId) {
      const refreshed = await listsApi.getTalentList(listId)
      set({ currentList: refreshed })
    }
  },

  updateMemberStatus: async (listId, candidateId, status) => {
    const updated = await listsApi.updateTalentListMember(listId, candidateId, { status })
    applyMemberUpdate(set, get, listId, candidateId, updated)
  },

  updateMemberNote: async (listId, candidateId, note) => {
    const updated = await listsApi.updateTalentListMember(listId, candidateId, {
      hunter_note: note,
    })
    applyMemberUpdate(set, get, listId, candidateId, updated)
  },

  removeMember: async (listId, candidateId) => {
    await listsApi.removeTalentListMember(listId, candidateId)
    set((s) => {
      if (s.currentList?.id !== listId) return s
      return {
        currentList: {
          ...s.currentList,
          members: s.currentList.members.filter((m) => m.candidate_id !== candidateId),
          member_count: s.currentList.member_count - 1,
        },
      }
    })
  },

  promoteMemberToProject: async (listId, candidateId, projectId) => {
    // True optimistic update: flip the row's status BEFORE the request. The
    // backend round-trip (DB writes + scheduling the EA background task) can
    // take a second or two when several concurrent promotes are in flight,
    // and without instant visual feedback the recruiter assumes the button
    // is broken and rage-clicks.
    //
    // We also CLEAR project_evaluation. A previous failed/completed eval would
    // otherwise make the new badge render as "评估失败" or the stale score —
    // both wrong because EA is about to re-run. Setting to null forces the
    // badge into its "评估中" branch until polling brings in the fresh row.
    //
    // If the request fails we restore the previous status from the snapshot
    // so the UI doesn't lie about state that didn't actually change.
    const snapshot = get().currentList
    if (snapshot?.id === listId) {
      set({
        currentList: {
          ...snapshot,
          members: snapshot.members.map((m) =>
            m.candidate_id === candidateId
              ? {
                  ...m,
                  status: 'added_to_project' as TalentListMemberStatus,
                  project_evaluation: null,
                }
              : m,
          ),
        },
      })
    }
    try {
      await listsApi.promoteListMemberToProject(listId, candidateId, projectId)
    } catch (err) {
      // Roll back the optimistic update.
      if (snapshot?.id === listId && get().currentList?.id === listId) {
        set({ currentList: snapshot })
      }
      throw err
    }
  },

  clearCurrentList: () => set({ currentList: null }),
}))

function summarize(detail: TalentListDetailResponse): TalentListSummaryResponse {
  const { members: _members, ...rest } = detail
  return rest
}

function applyMemberUpdate(
  set: (
    partial:
      | Partial<TalentListState>
      | ((s: TalentListState) => Partial<TalentListState>),
  ) => void,
  get: () => TalentListState,
  listId: string,
  candidateId: string,
  updated: TalentListMemberResponse,
) {
  const current = get().currentList
  if (!current || current.id !== listId) return
  set({
    currentList: {
      ...current,
      members: current.members.map((m) =>
        m.candidate_id === candidateId
          ? {
              ...m,
              status: updated.status,
              hunter_note: updated.hunter_note,
              updated_at: updated.updated_at,
            }
          : m,
      ),
    },
  })
}
