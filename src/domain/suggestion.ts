import type { RepositoryIntent, RepositoryLifecycleStatus } from './repository'

export type SuggestionSource = 'script' | 'rule' | 'ai'

export type TriageQueueId =
  'cleanup' | 'similar' | 'revived' | 'try' | 'uncertain'

export interface RepositorySuggestion {
  id?: number
  repositoryId: number
  suggestedIntent?: RepositoryIntent
  suggestedLifecycleStatus?: RepositoryLifecycleStatus
  suggestedTags: string[]
  queueId?: TriageQueueId
  groupKey?: string
  matchedRuleIds: string[]
  reasons: string[]
  confidence?: number
  source: SuggestionSource
  ruleSetVersion?: string
  generatedAt: string
}
