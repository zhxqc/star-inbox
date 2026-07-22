import { afterEach, describe, expect, it, vi } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { createStarredRepositoryFixture } from '../../test/github-fixture'
import {
  ImportCancelledError,
  importStars,
  type ImportStarsOptions,
} from './import-stars'

describe('importStars workflow', () => {
  const databases: StarInboxDatabase[] = []
  const user: ImportStarsOptions['user'] = {
    id: 7,
    login: 'example',
    avatarUrl: 'https://avatars.githubusercontent.com/u/7?v=4',
  }

  afterEach(async () => {
    await Promise.all(
      databases.map(async (database) => {
        database.close()
        await database.delete()
      }),
    )
    databases.length = 0
  })

  it('commits all pages and never persists the token', async () => {
    const database = new StarInboxDatabase(`import-${crypto.randomUUID()}`)
    databases.push(database)
    const token = 'memory-only-import-token'
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
            id: 43,
            node_id: 'R_second',
            name: 'second',
            full_name: 'example/second',
            html_url: 'https://github.com/example/second',
          }),
        ],
        totalPages: 2,
      })
    const progress = vi.fn()

    const result = await importStars(
      { token, user, onProgress: progress },
      { listStarredRepositoriesPage },
      database,
    )

    expect(result.repositoryCount).toBe(2)
    expect(await database.repositories.count()).toBe(2)
    expect(await database.importStaging.count()).toBe(0)
    expect(await database.importSnapshots.get(result.snapshotId)).toMatchObject(
      {
        status: 'completed',
        repositoryCount: 2,
        lastCompletedPage: 2,
      },
    )
    expect(progress).toHaveBeenLastCalledWith({
      page: 2,
      totalPages: 2,
      importedCount: 2,
      pageSize: 1,
    })
    expect(
      JSON.stringify({
        repositories: await database.repositories.toArray(),
        snapshots: await database.importSnapshots.toArray(),
      }),
    ).not.toContain(token)
  })

  it('marks an aborted import as cancelled without committing partial data', async () => {
    const database = new StarInboxDatabase(`import-${crypto.randomUUID()}`)
    databases.push(database)
    const listStarredRepositoriesPage = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'))

    await expect(
      importStars(
        { token: 'memory-token', user },
        { listStarredRepositoriesPage },
        database,
      ),
    ).rejects.toBeInstanceOf(ImportCancelledError)

    expect(await database.repositories.count()).toBe(0)
    expect(await database.importSnapshots.toArray()).toEqual([
      expect.objectContaining({ status: 'cancelled' }),
    ])
  })
})
