import type { GitHubRepository } from '../../domain/repository'
import { db, type StarInboxDatabase } from '../database'

export async function stageRepositoryPage(
  snapshotId: string,
  repositories: GitHubRepository[],
  database: StarInboxDatabase = db,
): Promise<number> {
  const uniqueRepositories = [
    ...new Map(
      repositories.map((repository) => [repository.githubId, repository]),
    ).values(),
  ]

  await database.transaction('rw', database.importStaging, async () => {
    await database.importStaging.bulkPut(uniqueRepositories)
  })

  return database.importStaging.where('snapshotId').equals(snapshotId).count()
}

export async function commitRepositorySnapshot(
  snapshotId: string,
  database: StarInboxDatabase = db,
): Promise<number> {
  return database.transaction(
    'rw',
    database.repositories,
    database.importStaging,
    async () => {
      const stagedRepositories = await database.importStaging
        .where('snapshotId')
        .equals(snapshotId)
        .toArray()
      await database.repositories.bulkPut(stagedRepositories)
      await database.importStaging
        .where('snapshotId')
        .equals(snapshotId)
        .delete()
      return stagedRepositories.length
    },
  )
}
