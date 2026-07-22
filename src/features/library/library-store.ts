import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  RepositoryIntent,
  RepositoryLifecycleStatus,
  UserRepositoryMetadata,
} from '../../domain/repository'

export interface RepositoryLibraryEntry {
  repository: GitHubRepository
  metadata?: UserRepositoryMetadata
}

export interface RepositoryLibraryPage {
  items: RepositoryLibraryEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BulkMetadataUpdate {
  intent?: RepositoryIntent
  lifecycleStatus?: RepositoryLifecycleStatus
  addTags?: string[]
}

export interface SaveRepositoryMetadataInput {
  repositoryId: number
  intent: RepositoryIntent
  lifecycleStatus: RepositoryLifecycleStatus
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

function mergeTags(existing: string[], additions: string[]) {
  return normalizeTags([...existing, ...additions])
}

async function readRepositoryPage(
  page: number,
  pageSize: number,
  database: StarInboxDatabase,
) {
  const total = await database.repositories.count()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const offset = (safePage - 1) * pageSize
  const datedCount = await database.repositories
    .where('starredAt')
    .above('')
    .count()
  const repositories: GitHubRepository[] = []

  if (offset < datedCount) {
    repositories.push(
      ...(await database.repositories
        .orderBy('starredAt')
        .reverse()
        .offset(offset)
        .limit(pageSize)
        .toArray()),
    )
  }

  const remaining = pageSize - repositories.length
  if (remaining > 0) {
    const missingOffset = Math.max(0, offset - datedCount)
    repositories.push(
      ...(await database.repositories
        .filter((repository) => !repository.starredAt)
        .offset(missingOffset)
        .limit(remaining)
        .toArray()),
    )
  }

  return { repositories, safePage, total, totalPages }
}

export async function getRepositoryLibraryPage(
  page: number,
  pageSize: number,
  database: StarInboxDatabase = db,
): Promise<RepositoryLibraryPage> {
  const safePageSize = [20, 50, 100].includes(pageSize) ? pageSize : 20
  const { repositories, safePage, total, totalPages } =
    await readRepositoryPage(page, safePageSize, database)
  const metadataRecords = await database.userMetadata.bulkGet(
    repositories.map((repository) => repository.githubId),
  )

  return {
    items: repositories.map((repository, index) => ({
      repository,
      metadata: metadataRecords[index],
    })),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  }
}

export async function bulkUpdateRepositoryMetadata(
  repositoryIds: number[],
  update: BulkMetadataUpdate,
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<UserRepositoryMetadata[]> {
  const uniqueIds = [...new Set(repositoryIds)]
  if (!uniqueIds.length) return []
  if (!update.intent && !update.lifecycleStatus && !update.addTags?.length) {
    return []
  }

  return database.transaction('rw', database.userMetadata, async () => {
    const existingRecords = await database.userMetadata.bulkGet(uniqueIds)
    const updatedAt = now.toISOString()
    const records = uniqueIds.map((repositoryId, index) => {
      const existing = existingRecords[index]
      const lifecycleStatus =
        update.lifecycleStatus ?? existing?.lifecycleStatus ?? 'inbox'
      return {
        ...existing,
        repositoryId,
        intent: update.intent ?? existing?.intent ?? 'inbox',
        lifecycleStatus,
        tags: mergeTags(existing?.tags ?? [], update.addTags ?? []),
        confirmedAt: existing?.confirmedAt ?? updatedAt,
        lastReviewedAt:
          lifecycleStatus === 'inbox' ? existing?.lastReviewedAt : updatedAt,
        lastVerifiedAt:
          lifecycleStatus === 'verified'
            ? (existing?.lastVerifiedAt ?? updatedAt)
            : existing?.lastVerifiedAt,
      } satisfies UserRepositoryMetadata
    })

    await database.userMetadata.bulkPut(records)
    return records
  })
}

export async function saveRepositoryMetadata(
  input: SaveRepositoryMetadataInput,
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<UserRepositoryMetadata> {
  return database.transaction(
    'rw',
    database.repositories,
    database.userMetadata,
    async () => {
      const repository = await database.repositories.get(input.repositoryId)
      if (!repository) throw new Error('无法找到要整理的本地仓库。')

      const existing = await database.userMetadata.get(input.repositoryId)
      const updatedAt = now.toISOString()
      const metadata: UserRepositoryMetadata = {
        ...existing,
        repositoryId: input.repositoryId,
        intent: input.intent,
        lifecycleStatus: input.lifecycleStatus,
        customSummary: optionalText(input.customSummary),
        whyStarred: optionalText(input.whyStarred),
        note: optionalText(input.note),
        tags: normalizeTags(input.tags),
        confirmedAt: existing?.confirmedAt ?? updatedAt,
        lastReviewedAt:
          input.lifecycleStatus === 'inbox'
            ? existing?.lastReviewedAt
            : updatedAt,
        lastVerifiedAt:
          input.lifecycleStatus === 'verified'
            ? (existing?.lastVerifiedAt ?? updatedAt)
            : existing?.lastVerifiedAt,
      }

      await database.userMetadata.put(metadata)
      return metadata
    },
  )
}
