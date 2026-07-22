import type { GitHubRepository } from '../domain/repository'
import type { StarredRepositoryResponse } from './schemas'

function optional(value: string | null | undefined): string | undefined {
  return value ?? undefined
}

export function normalizeStarredRepository(
  starredRepository: StarredRepositoryResponse,
  snapshotId: string,
  now = new Date().toISOString(),
): GitHubRepository {
  const { repo } = starredRepository

  return {
    githubId: repo.id,
    nodeId: repo.node_id,
    name: repo.name,
    fullName: repo.full_name,
    ownerLogin: repo.owner.login,
    ownerAvatarUrl: optional(repo.owner.avatar_url),
    htmlUrl: repo.html_url,
    description: optional(repo.description),
    homepage: optional(repo.homepage),
    topics: [...repo.topics],
    primaryLanguage: optional(repo.language),
    licenseSpdx: optional(repo.license?.spdx_id),
    fork: repo.fork,
    isTemplate: repo.is_template,
    defaultBranch: optional(repo.default_branch),
    starredAt: optional(starredRepository.starred_at),
    createdAt: optional(repo.created_at),
    updatedAt: optional(repo.updated_at),
    pushedAt: optional(repo.pushed_at),
    archived: repo.archived,
    disabled: repo.disabled,
    private: repo.private,
    visibility: optional(repo.visibility),
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    size: repo.size,
    fetchedAt: now,
    lastSeenAt: now,
    snapshotId,
  }
}

export function normalizeStarredRepositories(
  repositories: StarredRepositoryResponse[],
  snapshotId: string,
  now = new Date().toISOString(),
): GitHubRepository[] {
  return repositories.map((repository) =>
    normalizeStarredRepository(repository, snapshotId, now),
  )
}
