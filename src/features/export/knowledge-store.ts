import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../../domain/repository'
import type { KnowledgeExportEntry } from './knowledge-export'

export interface KnowledgeWorkspace {
  toVerify: KnowledgeExportEntry[]
  verified: KnowledgeExportEntry[]
}

export interface SaveVerificationInput {
  repositoryId: number
  customSummary?: string
  whyStarred?: string
  useCases?: string
  alternatives?: string
  verificationSummary: string
  tags: string[]
}

function optionalText(value?: string) {
  return value?.trim() || undefined
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>()
  return tags.flatMap((rawTag) => {
    const tag = rawTag.trim().replace(/^#+/, '')
    const identity = tag.toLocaleLowerCase()
    if (!tag || seen.has(identity)) return []
    seen.add(identity)
    return [tag]
  })
}

function sortEntries(entries: KnowledgeExportEntry[]) {
  return entries.sort((left, right) => {
    const leftTime = new Date(
      left.metadata.lastVerifiedAt ?? left.metadata.lastReviewedAt ?? 0,
    ).getTime()
    const rightTime = new Date(
      right.metadata.lastVerifiedAt ?? right.metadata.lastReviewedAt ?? 0,
    ).getTime()
    return (
      rightTime - leftTime ||
      right.repository.githubId - left.repository.githubId
    )
  })
}

export async function getKnowledgeWorkspace(
  database: StarInboxDatabase = db,
): Promise<KnowledgeWorkspace> {
  const metadataRecords = await database.userMetadata
    .where('lifecycleStatus')
    .anyOf(['to-verify', 'verified'])
    .toArray()
  const repositories = await database.repositories.bulkGet(
    metadataRecords.map((metadata) => metadata.repositoryId),
  )
  const entries = metadataRecords.flatMap((metadata, index) => {
    const repository = repositories[index]
    return repository ? [{ repository, metadata }] : []
  })
  return {
    toVerify: sortEntries(
      entries.filter((entry) => entry.metadata.lifecycleStatus === 'to-verify'),
    ),
    verified: sortEntries(
      entries.filter((entry) => entry.metadata.lifecycleStatus === 'verified'),
    ),
  }
}

export async function saveVerification(
  input: SaveVerificationInput,
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<{ repository: GitHubRepository; metadata: UserRepositoryMetadata }> {
  return database.transaction(
    'rw',
    database.repositories,
    database.userMetadata,
    async () => {
      const repository = await database.repositories.get(input.repositoryId)
      if (!repository) throw new Error('无法找到要验证的仓库。')
      const existing = await database.userMetadata.get(input.repositoryId)
      const verifiedAt = now.toISOString()
      const verificationSummary = optionalText(input.verificationSummary)
      if (!verificationSummary) throw new Error('验证结论不能为空。')
      const metadata: UserRepositoryMetadata = {
        ...existing,
        repositoryId: input.repositoryId,
        intent:
          existing?.intent === 'inbox' || !existing ? 'using' : existing.intent,
        lifecycleStatus: 'verified',
        customSummary: optionalText(input.customSummary),
        whyStarred: optionalText(input.whyStarred),
        useCases: optionalText(input.useCases),
        alternatives: optionalText(input.alternatives),
        verificationSummary,
        tags: normalizeTags(input.tags),
        confirmedAt: existing?.confirmedAt ?? verifiedAt,
        lastReviewedAt: verifiedAt,
        lastVerifiedAt: verifiedAt,
      }
      await database.userMetadata.put(metadata)
      return { repository, metadata }
    },
  )
}
