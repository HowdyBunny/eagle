import { create } from 'zustand'
import type {
  CandidateCreate,
  CandidateUpdate,
  CandidateResponse,
  CandidateSearchResult,
  QueryRewriteResponse,
} from '@/types'
import * as candidatesApi from '@/lib/api/candidates'

interface CandidateFilters {
  location: string
  minYears: number | undefined
  maxYears: number | undefined
  company: string
}

interface CandidateState {
  candidates: CandidateResponse[]
  searchResults: CandidateSearchResult[]
  isSearchMode: boolean
  total: number
  filters: CandidateFilters
  skip: number
  limit: number
  loading: boolean
  error: string | null

  // Smart-search state — see TalentPoolView for UX wiring.
  // `smartSearch` is the user-toggle (persisted in localStorage).
  // `rewriteResult` is the latest LLM rewrite output we displayed as chips.
  // `rewriteLoading` is true while the rewrite request is in flight.
  smartSearch: boolean
  rewriteResult: QueryRewriteResponse | null
  rewriteLoading: boolean

  fetchCandidates: () => Promise<void>
  searchCandidates: (query: string) => Promise<void>
  rerunSearchWithCurrentRewrite: (query: string) => Promise<void>
  addCandidate: (data: CandidateCreate) => Promise<CandidateResponse>
  updateCandidate: (id: string, data: CandidateUpdate) => Promise<CandidateResponse>
  deleteCandidate: (id: string) => Promise<void>
  setFilters: (filters: Partial<CandidateFilters>) => void
  setPage: (skip: number) => void
  clearSearch: () => void

  setSmartSearch: (on: boolean) => void
  clearRewriteResult: () => void
  removeRewriteFilter: (
    bucket: 'filters' | 'exclusions',
    key: string,
    value?: string,
  ) => void
}

const defaultFilters: CandidateFilters = {
  location: '',
  minYears: undefined,
  maxYears: undefined,
  company: '',
}

const SMART_SEARCH_STORAGE_KEY = 'eagle.talent.smartSearch'

function loadSmartSearch(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(SMART_SEARCH_STORAGE_KEY)
  return raw === null ? true : raw === 'true'
}

function persistSmartSearch(on: boolean) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SMART_SEARCH_STORAGE_KEY, String(on))
  }
}

// Build the search payload by merging UI filter chips with LLM-extracted
// fields. UI chips take precedence — recruiters explicitly set them, so we
// don't want a rewrite to silently override an explicit choice.
function buildSearchPayload(
  query: string,
  filters: CandidateFilters,
  rewrite: QueryRewriteResponse | null,
) {
  const rf = rewrite?.filters
  const re = rewrite?.exclusions
  return {
    query: rewrite?.semantic_query?.trim() || query,
    location: filters.location || rf?.location || undefined,
    min_years_experience: filters.minYears ?? rf?.min_years_experience ?? undefined,
    max_years_experience: filters.maxYears ?? rf?.max_years_experience ?? undefined,
    current_company: filters.company || rf?.current_company || undefined,
    schools: rf?.schools && rf.schools.length > 0 ? rf.schools : undefined,
    exclude_companies:
      re?.exclude_companies && re.exclude_companies.length > 0 ? re.exclude_companies : undefined,
    exclude_locations:
      re?.exclude_locations && re.exclude_locations.length > 0 ? re.exclude_locations : undefined,
    exclude_query: re?.exclude_query || undefined,
  }
}

export const useCandidateStore = create<CandidateState>((set, get) => ({
  candidates: [],
  searchResults: [],
  isSearchMode: false,
  total: 0,
  filters: defaultFilters,
  skip: 0,
  limit: 20,
  loading: false,
  error: null,

  smartSearch: loadSmartSearch(),
  rewriteResult: null,
  rewriteLoading: false,

  fetchCandidates: async () => {
    const { filters, skip, limit } = get()
    set({ loading: true, error: null, isSearchMode: false })
    try {
      const candidates = await candidatesApi.listCandidates({
        location: filters.location || undefined,
        min_years: filters.minYears,
        max_years: filters.maxYears,
        company: filters.company || undefined,
        skip,
        limit,
      })
      set({ candidates, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  searchCandidates: async (query) => {
    const { filters, smartSearch } = get()
    set({ loading: true, error: null, isSearchMode: true })

    // Smart-search path: ask the backend to rewrite the query into
    // structured filters before searching. The endpoint itself decides
    // whether to spend an LLM call (identifier / short / keyword queries
    // skip the LLM and just echo the raw query back).
    let rewrite: QueryRewriteResponse | null = null
    if (smartSearch) {
      set({ rewriteLoading: true })
      try {
        rewrite = await candidatesApi.rewriteSearchQuery(query)
      } catch (e) {
        console.warn('rewriteSearchQuery failed; falling back to raw query', e)
      } finally {
        set({ rewriteLoading: false })
      }
      set({ rewriteResult: rewrite })
    } else {
      set({ rewriteResult: null })
    }

    try {
      const payload = buildSearchPayload(query, filters, rewrite)
      const results = await candidatesApi.searchCandidates(payload)
      set({ searchResults: results, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  // Re-runs the search using the *current* rewriteResult (which the user
  // may have edited by removing chips). Skips the LLM rewrite call so chip
  // removals stick instead of being overwritten by a fresh rewrite.
  rerunSearchWithCurrentRewrite: async (query) => {
    const { filters, rewriteResult } = get()
    set({ loading: true, error: null, isSearchMode: true })
    try {
      const payload = buildSearchPayload(query, filters, rewriteResult)
      const results = await candidatesApi.searchCandidates(payload)
      set({ searchResults: results, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  addCandidate: async (data) => {
    const created = await candidatesApi.addCandidate(data)
    set((s) => ({ candidates: [created, ...s.candidates] }))
    return created
  },

  updateCandidate: async (id, data) => {
    const updated = await candidatesApi.updateCandidate(id, data)
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === id ? updated : c)),
      searchResults: s.searchResults.map((r) =>
        r.candidate.id === id ? { ...r, candidate: updated } : r,
      ),
    }))
    return updated
  },

  deleteCandidate: async (id) => {
    await candidatesApi.deleteCandidate(id)
    set((s) => ({
      candidates: s.candidates.filter((c) => c.id !== id),
      searchResults: s.searchResults.filter((r) => r.candidate.id !== id),
    }))
  },

  setFilters: (partial) => {
    set({ filters: { ...get().filters, ...partial }, skip: 0 })
  },

  setPage: (skip) => set({ skip }),

  clearSearch: () =>
    set({ isSearchMode: false, searchResults: [], rewriteResult: null }),

  setSmartSearch: (on) => {
    persistSmartSearch(on)
    set({ smartSearch: on })
    if (!on) {
      // Turning the toggle off should immediately hide any chips that came
      // from a previous LLM rewrite.
      set({ rewriteResult: null })
    }
  },

  clearRewriteResult: () => set({ rewriteResult: null }),

  removeRewriteFilter: (bucket, key, value) => {
    const current = get().rewriteResult
    if (!current) return
    if (bucket === 'filters') {
      const next = { ...current.filters }
      if (key === 'schools' && value) {
        next.schools = next.schools.filter((s) => s !== value)
      } else {
        ;(next as Record<string, unknown>)[key] = key === 'schools' ? [] : null
      }
      set({ rewriteResult: { ...current, filters: next } })
    } else {
      const next = { ...current.exclusions }
      if (key === 'exclude_companies' && value) {
        next.exclude_companies = next.exclude_companies.filter((s) => s !== value)
      } else if (key === 'exclude_locations' && value) {
        next.exclude_locations = next.exclude_locations.filter((s) => s !== value)
      } else if (key === 'exclude_query') {
        next.exclude_query = null
      }
      set({ rewriteResult: { ...current, exclusions: next } })
    }
  },
}))
