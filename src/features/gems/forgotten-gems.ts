import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../../domain/repository'

const DAY = 24 * 60 * 60 * 1000

export interface ForgottenGem {
  repository: GitHubRepository
  metadata?: UserRepositoryMetadata
  score: number
  reasons: string[]
}

function dateValue(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}

function stableDailyJitter(repositoryId: number, dateKey: string) {
  let hash = repositoryId
  for (const character of dateKey)
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash % 1000) / 1000
}

export function rankForgottenGems(
  repositories: GitHubRepository[],
  metadataRecords: UserRepositoryMetadata[],
  now = new Date(),
  limit = 8,
): ForgottenGem[] {
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )
  const dateKey = now.toISOString().slice(0, 10)

  return repositories
    .flatMap((repository) => {
      const metadata = metadataByRepository.get(repository.githubId)
      if (
        repository.archived ||
        repository.disabled ||
        metadata?.lifecycleStatus === 'dropped'
      ) {
        return []
      }

      const starredAt = dateValue(repository.starredAt)
      const pushedAt = dateValue(repository.pushedAt)
      const starredDays = starredAt
        ? Math.max(0, (now.getTime() - starredAt) / DAY)
        : 0
      const pushedDays = pushedAt
        ? Math.max(0, (now.getTime() - pushedAt) / DAY)
        : Number.POSITIVE_INFINITY
      let score = stableDailyJitter(repository.githubId, dateKey)
      const reasons: string[] = []

      if (starredDays >= 730) {
        score += 3
        reasons.push(`大约 ${Math.floor(starredDays / 365)} 年前收藏`)
      } else if (starredDays >= 365) {
        score += 2
        reasons.push('收藏超过一年')
      }
      if (pushedDays <= 90) {
        score += 4
        reasons.push('最近 90 天内仍有推送')
      } else if (pushedDays <= 365) {
        score += 1.5
        reasons.push('最近一年仍有推送')
      }
      if (!metadata?.confirmedAt) {
        score += 2
        reasons.push('从未完成回顾')
      }
      if (
        metadata?.intent === 'try' &&
        metadata.lifecycleStatus !== 'verified'
      ) {
        score += 2
        reasons.push('曾标记为准备试用，但还没有验证')
      }

      return reasons.length
        ? [{ repository, metadata, score, reasons: reasons.slice(0, 3) }]
        : []
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.repository.githubId - left.repository.githubId,
    )
    .slice(0, Math.max(1, Math.min(limit, 20)))
}

export async function getForgottenGems(
  database: StarInboxDatabase = db,
  now = new Date(),
  limit = 8,
) {
  const [repositories, metadataRecords] = await Promise.all([
    database.repositories.toArray(),
    database.userMetadata.toArray(),
  ])
  return rankForgottenGems(repositories, metadataRecords, now, limit)
}
