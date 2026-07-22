import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import type { GitHubRepository } from '../../domain/repository'
import { getReviewWorkspace, saveRepositoryReview } from './review-queue'

function repository(githubId: number, starredAt: string): GitHubRepository {
  return {
    githubId,
    nodeId: `node-${githubId}`,
    name: `repository-${githubId}`,
    fullName: `example/repository-${githubId}`,
    ownerLogin: 'example',
    htmlUrl: `https://github.com/example/repository-${githubId}`,
    topics: [],
    fork: false,
    isTemplate: false,
    archived: false,
    disabled: false,
    private: false,
    stargazersCount: githubId,
    forksCount: 0,
    openIssuesCount: 0,
    size: 1,
    starredAt,
    fetchedAt: '2026-07-22T00:00:00.000Z',
    lastSeenAt: '2026-07-22T00:00:00.000Z',
    snapshotId: 'snapshot-1',
  }
}

describe('review queue persistence', () => {
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

  it('orders unreviewed repositories by starred date and separates reviewed records', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    await database.repositories.bulkPut([
      repository(1, '2026-06-01T00:00:00.000Z'),
      repository(2, '2026-07-01T00:00:00.000Z'),
      repository(3, '2026-05-01T00:00:00.000Z'),
    ])
    await database.userMetadata.put({
      repositoryId: 3,
      intent: 'using',
      lifecycleStatus: 'reviewed',
      tags: [],
      confirmedAt: '2026-07-20T00:00:00.000Z',
      lastReviewedAt: '2026-07-20T00:00:00.000Z',
    })

    const workspace = await getReviewWorkspace(database)

    expect(
      workspace.pending.map(({ repository }) => repository.githubId),
    ).toEqual([2, 1])
    expect(
      workspace.reviewed.map(({ repository }) => repository.githubId),
    ).toEqual([3])
    expect(workspace.total).toBe(3)
  })

  it('writes only user metadata, normalizes tags and preserves an advanced lifecycle status', async () => {
    const database = new StarInboxDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const githubRepository = repository(42, '2026-07-01T00:00:00.000Z')
    await database.repositories.put(githubRepository)
    await database.userMetadata.put({
      repositoryId: 42,
      intent: 'try',
      lifecycleStatus: 'verified',
      tags: ['old'],
      confirmedAt: '2026-07-10T00:00:00.000Z',
      lastVerifiedAt: '2026-07-18T00:00:00.000Z',
    })

    const saved = await saveRepositoryReview(
      {
        repositoryId: 42,
        intent: 'using',
        customSummary: '  本地回顾 Stars  ',
        whyStarred: '  准备长期使用  ',
        note: '  私人结论  ',
        tags: [' Local-first ', '#GitHub', 'github', ''],
      },
      database,
      new Date('2026-07-22T08:00:00.000Z'),
    )

    expect(saved).toMatchObject({
      repositoryId: 42,
      intent: 'using',
      lifecycleStatus: 'verified',
      customSummary: '本地回顾 Stars',
      whyStarred: '准备长期使用',
      note: '私人结论',
      tags: ['Local-first', 'GitHub'],
      confirmedAt: '2026-07-10T00:00:00.000Z',
      lastReviewedAt: '2026-07-22T08:00:00.000Z',
      lastVerifiedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(await database.repositories.get(42)).toEqual(githubRepository)
  })
})
