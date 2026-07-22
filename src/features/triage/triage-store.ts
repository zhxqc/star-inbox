import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../../domain/repository'
import type { TriageQueueId } from '../../domain/suggestion'
import {
  generateTriageRecommendations,
  type TriageRecommendation,
} from './triage-engine'

export interface TriageWorkspaceItem {
  repository: GitHubRepository
  metadata?: UserRepositoryMetadata
  suggestion: TriageRecommendation
}

export interface TriageWorkspace {
  items: TriageWorkspaceItem[]
  counts: Record<TriageQueueId, number>
  generatedAt: string
}

const emptyCounts: Record<TriageQueueId, number> = {
  cleanup: 0,
  similar: 0,
  revived: 0,
  try: 0,
  uncertain: 0,
}

export async function refreshTriageWorkspace(
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<TriageWorkspace> {
  const [repositories, metadataRecords] = await Promise.all([
    database.repositories.toArray(),
    database.userMetadata.toArray(),
  ])
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )
  const suggestions = generateTriageRecommendations(
    repositories,
    metadataRecords,
    now,
  )

  await database.transaction('rw', database.suggestions, async () => {
    await database.suggestions.where('source').equals('rule').delete()
    if (suggestions.length) await database.suggestions.bulkAdd(suggestions)
  })

  const repositoryById = new Map(
    repositories.map((repository) => [repository.githubId, repository]),
  )
  const items = suggestions.flatMap((suggestion) => {
    const repository = repositoryById.get(suggestion.repositoryId)
    return repository
      ? [
          {
            repository,
            metadata: metadataByRepository.get(repository.githubId),
            suggestion,
          },
        ]
      : []
  })
  const counts = { ...emptyCounts }
  for (const item of items) counts[item.suggestion.queueId] += 1

  return {
    items,
    counts,
    generatedAt: now.toISOString(),
  }
}

export async function confirmTriageSuggestions(
  repositoryIds: number[],
  database: StarInboxDatabase = db,
  now = new Date(),
) {
  const ids = [...new Set(repositoryIds)]
  if (!ids.length) return []
  const suggestions = await database.suggestions
    .where('repositoryId')
    .anyOf(ids)
    .and((suggestion) => suggestion.source === 'rule')
    .toArray()
  const suggestionByRepository = new Map(
    suggestions.map((suggestion) => [suggestion.repositoryId, suggestion]),
  )
  const confirmedAt = now.toISOString()
  const confirmed: UserRepositoryMetadata[] = []

  await database.transaction('rw', database.userMetadata, async () => {
    const existingRecords = await database.userMetadata.bulkGet(ids)
    const existingByRepository = new Map(
      existingRecords.flatMap((metadata) =>
        metadata ? [[metadata.repositoryId, metadata] as const] : [],
      ),
    )
    for (const repositoryId of ids) {
      const existing = existingByRepository.get(repositoryId)
      const suggestion = suggestionByRepository.get(repositoryId)
      if (!suggestion || existing?.confirmedAt) continue

      const lifecycleStatus =
        suggestion.suggestedLifecycleStatus ??
        existing?.lifecycleStatus ??
        'reviewed'
      const metadata: UserRepositoryMetadata = {
        ...existing,
        repositoryId,
        intent: suggestion.suggestedIntent ?? existing?.intent ?? 'uncertain',
        lifecycleStatus,
        tags: suggestion.suggestedTags,
        confirmedAt,
        lastReviewedAt: confirmedAt,
        lastVerifiedAt:
          lifecycleStatus === 'verified'
            ? confirmedAt
            : existing?.lastVerifiedAt,
      }
      await database.userMetadata.put(metadata)
      confirmed.push(metadata)
    }
  })

  return confirmed
}
