export interface OntologyResponse {
  id: string
  industry: string
  concept: string
  synonyms: string[] | null
  tech_stack: string[] | null
  prerequisites: string[] | null
  key_positions: string[] | null
  skill_relations: Record<string, string[]> | null
  jargon: Record<string, string> | null
  created_at: string
  updated_at: string
}
