import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { createRepositoryFixture } from '../../test/repository-fixture'
import { getDashboardStats } from './dashboard-stats'

describe('dashboard stats', () => {
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

  it('separates pending, verified, stale, archived, languages and topics', async () => {
    const database = new StarInboxDatabase(`dashboard-${crypto.randomUUID()}`)
    databases.push(database)
    await database.repositories.bulkPut([
      createRepositoryFixture({
        githubId: 1,
        fullName: 'example/recent',
        starredAt: '2026-07-10T00:00:00.000Z',
        pushedAt: '2026-07-01T00:00:00.000Z',
        topics: ['local-first', 'github'],
      }),
      createRepositoryFixture({
        githubId: 2,
        fullName: 'example/old',
        starredAt: '2024-01-01T00:00:00.000Z',
        pushedAt: '2024-01-01T00:00:00.000Z',
        archived: true,
        primaryLanguage: 'Python',
        topics: ['github'],
      }),
    ])
    await database.userMetadata.put({
      repositoryId: 1,
      intent: 'using',
      lifecycleStatus: 'verified',
      tags: [],
      confirmedAt: '2026-07-20T00:00:00.000Z',
    })

    const stats = await getDashboardStats(
      database,
      new Date('2026-07-22T00:00:00.000Z'),
    )

    expect(stats).toMatchObject({
      total: 2,
      pendingReview: 1,
      reviewed: 1,
      verified: 1,
      archived: 1,
      staleOneYear: 1,
      starredLast30Days: 1,
    })
    expect(stats.languages).toEqual([
      { name: 'Python', count: 1 },
      { name: 'TypeScript', count: 1 },
    ])
    expect(stats.topics[0]).toEqual({ name: 'github', count: 2 })
  })
})
