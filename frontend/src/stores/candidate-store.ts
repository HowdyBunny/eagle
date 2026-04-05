import { create } from 'zustand'
import type { CandidateResponse, CandidateSearchResult } from '@/types'
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
  fetchCandidates: () => Promise<void>
  searchCandidates: (query: string) => Promise<void>
  setFilters: (filters: Partial<CandidateFilters>) => void
  setPage: (skip: number) => void
  clearSearch: () => void
}

const defaultFilters: CandidateFilters = {
  location: '',
  minYears: undefined,
  maxYears: undefined,
  company: '',
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
    const { filters } = get()
    set({ loading: true, error: null, isSearchMode: true })
    try {
      const results = await candidatesApi.searchCandidates({
        query,
        location: filters.location || undefined,
        min_years_experience: filters.minYears,
        max_years_experience: filters.maxYears,
        current_company: filters.company || undefined,
      })
      set({ searchResults: results, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  setFilters: (partial) => {
    set({ filters: { ...get().filters, ...partial }, skip: 0 })
  },

  setPage: (skip) => set({ skip }),

  clearSearch: () => set({ isSearchMode: false, searchResults: [] }),
}))
