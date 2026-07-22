import type { AuthenticatedGitHubUser } from '../../domain/import'
import { db, type StarInboxDatabase } from '../database'

export async function createImportSnapshot(
  user: AuthenticatedGitHubUser,
  database: StarInboxDatabase = db,
): Promise<string> {
  const id = crypto.randomUUID()
  await database.importSnapshots.add({
    id,
    status: 'pending',
    startedAt: new Date().toISOString(),
    repositoryCount: 0,
    lastCompletedPage: 0,
    accountLogin: user.login,
  })
  return id
}
