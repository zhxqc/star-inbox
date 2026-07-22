import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import type { GitHubRepository } from '../../domain/repository'
import {
  bulkUpdateRepositoryMetadata,
  getRepositoryLibraryPage,
  saveRepositoryMetadata,
} from './library-store'

function repository(githubId: number): GitHubRepository {
  return {
    githubId,
    nodeId: `node-${githubId}`,
    name: `repository-${githubId}`,
    fullName: `example/repository-${githubId}`,
    ownerLogin: 'example',
    htmlUrl: `https://github.com/example/repository-${githubId}`,
    topics: ['local-first'],
    fork: false,
    isTemplate: false,
    archived: false,
    disabled: false,
    private: false,
    stargazersCount: githubId,
    forksCount: 0,
    openIssuesCount: 0,
    size: 1,
    starredAt:
      githubId === 45
        ? undefined
        : new Date(Date.UTC(2026, 0, githubId)).toISOString(),
    fetchedAt: '2026-07-22T00:00:00.000Z',
    lastSeenAt: '2026-07-22T00:00:00.000Z',
    snapshotId: 'snapshot-1',
  }
}

describe('repository library storage', () => {
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

  it('returns every repository through adjustable 20-item pages', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    await database.repositories.bulkPut(
      Array.from({ length: 45 }, (_, index) => repository(index + 1)),
    )
    await database.userMetadata.put({
      repositoryId: 25,
      intent: 'reference',
      lifecycleStatus: 'reviewed',
      tags: ['docs'],
    })

    const first = await getRepositoryLibraryPage(1, 20, database)
    const second = await getRepositoryLibraryPage(2, 20, database)
    const third = await getRepositoryLibraryPage(3, 20, database)

    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(20)
    expect(third.items).toHaveLength(5)
    expect(first.total).toBe(45)
    expect(first.totalPages).toBe(3)
    const repositoryIds = [...first.items, ...second.items, ...third.items].map(
      ({ repository: item }) => item.githubId,
    )
    expect(repositoryIds).toHaveLength(45)
    expect(new Set(repositoryIds).size).toBe(45)
    expect(repositoryIds).toContain(45)
  })

  it('applies bulk classification only to user metadata', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = [repository(1), repository(2)]
    await database.repositories.bulkPut(repositories)

    const records = await bulkUpdateRepositoryMetadata(
      [1, 2],
      {
        intent: 'try',
        lifecycleStatus: 'reviewed',
        addTags: ['AI', '#Local-first', 'ai'],
      },
      database,
      new Date('2026-07-22T08:00:00.000Z'),
    )

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      intent: 'try',
      lifecycleStatus: 'reviewed',
      tags: ['AI', 'Local-first'],
      lastReviewedAt: '2026-07-22T08:00:00.000Z',
    })
    expect(await database.repositories.toArray()).toEqual(repositories)
  })

  it('saves a complete per-repository decision without changing GitHub data', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const githubRepository = repository(7)
    await database.repositories.put(githubRepository)

    const metadata = await saveRepositoryMetadata(
      {
        repositoryId: 7,
        intent: 'using',
        lifecycleStatus: 'verified',
        customSummary: '  工作流引擎  ',
        whyStarred: '  技术选型  ',
        note: '  已验证  ',
        tags: ['Automation', 'automation'],
      },
      database,
      new Date('2026-07-22T09:00:00.000Z'),
    )

    expect(metadata).toMatchObject({
      intent: 'using',
      lifecycleStatus: 'verified',
      customSummary: '工作流引擎',
      whyStarred: '技术选型',
      note: '已验证',
      tags: ['Automation'],
      lastVerifiedAt: '2026-07-22T09:00:00.000Z',
    })
    expect(await database.repositories.get(7)).toEqual(githubRepository)
  })
})
