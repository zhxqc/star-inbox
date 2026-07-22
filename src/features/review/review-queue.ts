import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  RepositoryIntent,
  UserRepositoryMetadata,
} from '../../domain/repository'

export type ReviewIntent = Exclude<RepositoryIntent, 'inbox'>

export interface ReviewQueueEntry {
  repository: GitHubRepository
  metadata?: UserRepositoryMetadata
}

export interface ReviewWorkspace {
  pending: ReviewQueueEntry[]
  reviewed: ReviewQueueEntry[]
  total: number
}

export interface SaveRepositoryReviewInput {
  repositoryId: number
  intent: ReviewIntent
  customSummary?: string
  whyStarred?: string
  note?: string
  tags: string[]
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/^#+/, '')
    const identity = tag.toLocaleLowerCase()
    if (!tag || seen.has(identity)) continue
    seen.add(identity)
    normalized.push(tag)
  }

  return normalized
}

function starredTimestamp(repository: GitHubRepository) {
  return repository.starredAt
    ? new Date(repository.starredAt).getTime()
    : Number.NEGATIVE_INFINITY
}

function reviewedTimestamp(metadata: UserRepositoryMetadata) {
  const value = metadata.lastReviewedAt ?? metadata.confirmedAt
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY
}

export async function getReviewWorkspace(
  database: StarInboxDatabase = db,
): Promise<ReviewWorkspace> {
  const [repositories, metadataRecords] = await Promise.all([
    database.repositories.toArray(),
    database.userMetadata.toArray(),
  ])
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )
  const pending: ReviewQueueEntry[] = []
  const reviewed: ReviewQueueEntry[] = []

  for (const repository of repositories) {
    const metadata = metadataByRepository.get(repository.githubId)
    const entry = { repository, metadata }
    if (!metadata || metadata.lifecycleStatus === 'inbox') {
      pending.push(entry)
    } else {
      reviewed.push(entry)
    }
  }

  pending.sort(
    (left, right) =>
      starredTimestamp(right.repository) - starredTimestamp(left.repository) ||
      right.repository.githubId - left.repository.githubId,
  )
  reviewed.sort(
    (left, right) =>
      reviewedTimestamp(right.metadata!) - reviewedTimestamp(left.metadata!) ||
      right.repository.githubId - left.repository.githubId,
  )

  return { pending, reviewed, total: repositories.length }
}

export async function saveRepositoryReview(
  input: SaveRepositoryReviewInput,
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<UserRepositoryMetadata> {
  return database.transaction(
    'rw',
    database.repositories,
    database.userMetadata,
    async () => {
      const repository = await database.repositories.get(input.repositoryId)
      if (!repository) throw new Error('无法找到要回顾的本地仓库。')

      const existing = await database.userMetadata.get(input.repositoryId)
      const reviewedAt = now.toISOString()
      const metadata: UserRepositoryMetadata = {
        ...existing,
        repositoryId: input.repositoryId,
        intent: input.intent,
        lifecycleStatus:
          existing && existing.lifecycleStatus !== 'inbox'
            ? existing.lifecycleStatus
            : 'reviewed',
        customSummary: optionalText(input.customSummary),
        whyStarred: optionalText(input.whyStarred),
        note: optionalText(input.note),
        tags: normalizeTags(input.tags),
        confirmedAt: existing?.confirmedAt ?? reviewedAt,
        lastReviewedAt: reviewedAt,
      }

      await database.userMetadata.put(metadata)
      return metadata
    },
  )
}
