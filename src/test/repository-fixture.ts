import type { GitHubRepository } from '../domain/repository'

export function createRepositoryFixture(
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository {
  const githubId = overrides.githubId ?? 42
  const fullName = overrides.fullName ?? `example/repository-${githubId}`
  return {
    githubId,
    nodeId: `node-${githubId}`,
    name: fullName.split('/')[1] ?? `repository-${githubId}`,
    fullName,
    ownerLogin: fullName.split('/')[0] ?? 'example',
    htmlUrl: `https://github.com/${fullName}`,
    description: 'A local-first developer tool.',
    topics: ['local-first', 'developer-tools'],
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    fork: false,
    isTemplate: false,
    starredAt: '2024-01-10T00:00:00.000Z',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    pushedAt: '2026-07-20T00:00:00.000Z',
    archived: false,
    disabled: false,
    private: false,
    visibility: 'public',
    stargazersCount: 100,
    forksCount: 10,
    openIssuesCount: 2,
    size: 1024,
    fetchedAt: '2026-07-22T00:00:00.000Z',
    lastSeenAt: '2026-07-22T00:00:00.000Z',
    snapshotId: 'snapshot-test',
    ...overrides,
  }
}
