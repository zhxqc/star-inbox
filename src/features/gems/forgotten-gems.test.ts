import { describe, expect, it } from 'vitest'
import { createRepositoryFixture } from '../../test/repository-fixture'
import { rankForgottenGems } from './forgotten-gems'

describe('rankForgottenGems', () => {
  it('prioritizes old unreviewed stars that still receive recent pushes', () => {
    const activeOldStar = createRepositoryFixture({
      githubId: 1,
      starredAt: '2021-01-01T00:00:00.000Z',
      pushedAt: '2026-07-20T00:00:00.000Z',
    })
    const recentStar = createRepositoryFixture({
      githubId: 2,
      starredAt: '2026-07-01T00:00:00.000Z',
      pushedAt: '2026-07-20T00:00:00.000Z',
    })

    const gems = rankForgottenGems(
      [recentStar, activeOldStar],
      [],
      new Date('2026-07-22T00:00:00.000Z'),
    )
    expect(gems[0]?.repository.githubId).toBe(1)
    expect(gems[0]?.reasons).toContain('最近 90 天内仍有推送')
  })
})
