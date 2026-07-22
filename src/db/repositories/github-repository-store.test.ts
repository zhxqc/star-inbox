import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../database'
import {
  commitRepositorySnapshot,
  stageRepositoryPage,
} from './github-repository-store'
import type { GitHubRepository } from '../../domain/repository'

function repository(stargazersCount: number): GitHubRepository {
  return {
    githubId: 42,
    nodeId: 'repo-node',
    name: 'star-inbox',
    fullName: 'example/star-inbox',
    ownerLogin: 'example',
    htmlUrl: 'https://github.com/example/star-inbox',
    topics: [],
    fork: false,
    isTemplate: false,
    archived: false,
    disabled: false,
    private: false,
    stargazersCount,
    forksCount: 0,
    openIssuesCount: 0,
    size: 1,
    fetchedAt: '2026-07-22T00:00:00.000Z',
    lastSeenAt: '2026-07-22T00:00:00.000Z',
    snapshotId: 'snapshot-1',
  }
}

describe('repository IndexedDB writes', () => {
  const databases: StarInboxDatabase[] = []

  afterEach(async () => {
    await Promise.all(
      databases.map(async (database) => {
        database.close()
        await database.delete()
      }),
    )
    databases.length = 0
  })

  it('deduplicates by GitHub id in staging and atomically commits the snapshot', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)

    await expect(
      stageRepositoryPage(
        'snapshot-1',
        [repository(10), repository(12)],
        database,
      ),
    ).resolves.toBe(1)
    expect(await database.repositories.count()).toBe(0)

    await expect(
      commitRepositorySnapshot('snapshot-1', database),
    ).resolves.toBe(1)
    expect(await database.repositories.count()).toBe(1)
    expect(await database.repositories.get(42)).toMatchObject({
      stargazersCount: 12,
    })
    expect(await database.importStaging.count()).toBe(0)
  })
})
