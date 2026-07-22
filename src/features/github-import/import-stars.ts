import { db, type StarInboxDatabase } from '../../db/database'
import {
  commitRepositorySnapshot,
  stageRepositoryPage,
} from '../../db/repositories/github-repository-store'
import { createImportSnapshot } from '../../db/repositories/import-snapshot-store'
import type { AuthenticatedGitHubUser } from '../../domain/import'
import {
  githubClient,
  type GitHubClient,
  GitHubApiError,
} from '../../github/client'
import {
  paginateStarredRepositories,
  StarredPageImportError,
  type ImportPageProgress,
} from '../../github/pagination'

export interface ImportStarsOptions {
  token: string
  user: AuthenticatedGitHubUser
  snapshotId?: string
  startPage?: number
  signal?: AbortSignal
  onProgress?: (progress: ImportPageProgress) => void
}

export interface ImportStarsResult {
  snapshotId: string
  repositoryCount: number
}

export class ImportStarsError extends Error {
  constructor(
    message: string,
    readonly snapshotId: string,
    readonly failedPage: number,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'ImportStarsError'
  }
}

export class ImportCancelledError extends Error {
  constructor(
    readonly snapshotId: string,
    readonly nextPage: number,
  ) {
    super('Import cancelled by the user.')
    this.name = 'ImportCancelledError'
  }
}

function toSafeImportError(error: unknown) {
  if (error instanceof StarredPageImportError) {
    const cause = error.cause
    if (cause instanceof GitHubApiError) {
      return {
        page: error.page,
        message: cause.message,
        retryable: cause.retryable || cause.status === 403,
      }
    }
    return {
      page: error.page,
      message: '这一页暂时无法保存，请重试。',
      retryable: true,
    }
  }
  return { page: 1, message: '导入未完成，请重试。', retryable: true }
}

export async function importStars(
  options: ImportStarsOptions,
  client: Pick<GitHubClient, 'listStarredRepositoriesPage'> = githubClient,
  database: StarInboxDatabase = db,
): Promise<ImportStarsResult> {
  const snapshotId =
    options.snapshotId ?? (await createImportSnapshot(options.user, database))
  const startPage = options.startPage ?? 1
  let lastCompletedPage = startPage - 1

  await database.importSnapshots.update(snapshotId, {
    status: 'running',
    failedPage: undefined,
  })

  try {
    const result = await paginateStarredRepositories(client, {
      token: options.token,
      snapshotId,
      startPage,
      signal: options.signal,
      onProgress: options.onProgress,
      onPage: async (repositories, page) => {
        const repositoryCount = await stageRepositoryPage(
          snapshotId,
          repositories,
          database,
        )
        await database.importSnapshots.update(snapshotId, {
          repositoryCount,
          lastCompletedPage: page,
        })
        lastCompletedPage = page
        return repositoryCount
      },
    })

    const repositoryCount = await commitRepositorySnapshot(snapshotId, database)
    await database.importSnapshots.update(snapshotId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      repositoryCount,
      lastCompletedPage: result.lastPage,
    })
    return { snapshotId, repositoryCount }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      await database.importSnapshots.update(snapshotId, { status: 'cancelled' })
      throw new ImportCancelledError(snapshotId, lastCompletedPage + 1)
    }

    const safeError = toSafeImportError(error)
    await database.importSnapshots.update(snapshotId, {
      status: 'failed',
      failedPage: safeError.page,
    })
    throw new ImportStarsError(
      safeError.message,
      snapshotId,
      safeError.page,
      safeError.retryable,
    )
  }
}
