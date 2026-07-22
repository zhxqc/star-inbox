import { describe, expect, it } from 'vitest'
import { createStarredRepositoryFixture } from '../test/github-fixture'
import { normalizeStarredRepository } from './normalize'

describe('normalizeStarredRepository', () => {
  it('keeps only the approved repository metadata and maps GitHub names', () => {
    const normalized = normalizeStarredRepository(
      createStarredRepositoryFixture(),
      'snapshot-1',
      '2026-07-22T00:00:00.000Z',
    )

    expect(normalized).toEqual({
      githubId: 42,
      nodeId: 'R_kgDOExample',
      name: 'star-inbox',
      fullName: 'example/star-inbox',
      ownerLogin: 'example',
      ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      htmlUrl: 'https://github.com/example/star-inbox',
      description: 'Review GitHub stars locally.',
      homepage: undefined,
      topics: ['local-first', 'github'],
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      fork: false,
      isTemplate: false,
      defaultBranch: 'main',
      starredAt: '2026-07-01T12:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-07-20T00:00:00Z',
      pushedAt: '2026-07-19T00:00:00Z',
      archived: false,
      disabled: false,
      private: false,
      visibility: 'public',
      stargazersCount: 120,
      forksCount: 12,
      openIssuesCount: 3,
      size: 2048,
      fetchedAt: '2026-07-22T00:00:00.000Z',
      lastSeenAt: '2026-07-22T00:00:00.000Z',
      snapshotId: 'snapshot-1',
    })
    expect(normalized).not.toHaveProperty('readme')
    expect(normalized).not.toHaveProperty('commits')
  })
})
