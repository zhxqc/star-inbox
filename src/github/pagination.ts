import type { GitHubRepository } from '../domain/repository'
import type { GitHubClient } from './client'
import { normalizeStarredRepositories } from './normalize'

export interface ImportPageProgress {
  page: number
  totalPages?: number
  importedCount: number
  pageSize: number
}

interface PaginationOptions {
  token: string
  snapshotId: string
  startPage?: number
  signal?: AbortSignal
  onPage: (repositories: GitHubRepository[], page: number) => Promise<number>
  onProgress?: (progress: ImportPageProgress) => void
}

export class StarredPageImportError extends Error {
  constructor(
    readonly page: number,
    cause: unknown,
  ) {
    super('A starred repositories page could not be imported.', { cause })
    this.name = 'StarredPageImportError'
  }
}

export async function paginateStarredRepositories(
  client: Pick<GitHubClient, 'listStarredRepositoriesPage'>,
  options: PaginationOptions,
): Promise<{ importedCount: number; lastPage: number }> {
  let page = options.startPage ?? 1
  let importedCount: number

  while (true) {
    let result
    try {
      result = await client.listStarredRepositoriesPage(
        options.token,
        page,
        options.signal,
      )
      const repositories = normalizeStarredRepositories(
        result.repositories,
        options.snapshotId,
      )
      importedCount = await options.onPage(repositories, page)
      options.onProgress?.({
        page,
        totalPages: result.totalPages,
        importedCount,
        pageSize: repositories.length,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
      throw new StarredPageImportError(page, error)
    }

    if (!result.nextPage) return { importedCount, lastPage: page }
    page = result.nextPage
  }
}
