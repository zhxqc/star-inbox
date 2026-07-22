import { db, type StarInboxDatabase } from '../../db/database'

export interface RankedValue {
  name: string
  count: number
}

export interface DashboardStats {
  total: number
  pendingReview: number
  reviewed: number
  verified: number
  archived: number
  staleOneYear: number
  starredLast30Days: number
  languages: RankedValue[]
  topics: RankedValue[]
}

function rank(values: string[], limit: number): RankedValue[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export async function getDashboardStats(
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<DashboardStats> {
  const [repositories, metadataRecords] = await Promise.all([
    database.repositories.toArray(),
    database.userMetadata.toArray(),
  ])
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )
  const reviewed = repositories.filter((repository) => {
    const metadata = metadataByRepository.get(repository.githubId)
    return metadata && metadata.lifecycleStatus !== 'inbox'
  }).length
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    total: repositories.length,
    pendingReview: repositories.length - reviewed,
    reviewed,
    verified: repositories.filter(
      (repository) =>
        metadataByRepository.get(repository.githubId)?.lifecycleStatus ===
        'verified',
    ).length,
    archived: repositories.filter((repository) => repository.archived).length,
    staleOneYear: repositories.filter(
      (repository) =>
        repository.pushedAt && new Date(repository.pushedAt) < oneYearAgo,
    ).length,
    starredLast30Days: repositories.filter(
      (repository) =>
        repository.starredAt && new Date(repository.starredAt) >= thirtyDaysAgo,
    ).length,
    languages: rank(
      repositories.flatMap((repository) =>
        repository.primaryLanguage ? [repository.primaryLanguage] : [],
      ),
      8,
    ),
    topics: rank(
      repositories.flatMap((repository) => repository.topics),
      12,
    ),
  }
}
