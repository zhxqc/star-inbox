import { describe, expect, it, vi } from 'vitest'
import { createStarredRepositoryFixture } from '../test/github-fixture'
import type { GitHubClient } from './client'
import { paginateStarredRepositories } from './pagination'

describe('paginateStarredRepositories', () => {
  it('follows GitHub next pages and reports saved progress', async () => {
    const listStarredRepositoriesPage = vi
      .fn()
      .mockResolvedValueOnce({
        repositories: [createStarredRepositoryFixture()],
        nextPage: 2,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        repositories: [
          createStarredRepositoryFixture({
            id: 99,
            full_name: 'example/second',
          }),
        ],
        totalPages: 2,
      })
    const client: Pick<GitHubClient, 'listStarredRepositoriesPage'> = {
      listStarredRepositoriesPage,
    }
    const savedIds: number[] = []
    const progress = vi.fn()

    const result = await paginateStarredRepositories(client, {
      token: 'memory-only-token',
      snapshotId: 'snapshot-1',
      onPage: (repositories) => {
        savedIds.push(...repositories.map((repository) => repository.githubId))
        return Promise.resolve(savedIds.length)
      },
      onProgress: progress,
    })

    expect(listStarredRepositoriesPage).toHaveBeenNthCalledWith(
      1,
      'memory-only-token',
      1,
      undefined,
    )
    expect(listStarredRepositoriesPage).toHaveBeenNthCalledWith(
      2,
      'memory-only-token',
      2,
      undefined,
    )
    expect(savedIds).toEqual([42, 99])
    expect(progress).toHaveBeenLastCalledWith({
      page: 2,
      totalPages: 2,
      importedCount: 2,
      pageSize: 1,
    })
    expect(result).toEqual({ importedCount: 2, lastPage: 2 })
  })
})
