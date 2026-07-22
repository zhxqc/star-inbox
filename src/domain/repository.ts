export type RepositoryIntent =
  'inbox' | 'try' | 'reference' | 'using' | 'content' | 'support' | 'uncertain'

export type RepositoryLifecycleStatus =
  'inbox' | 'reviewed' | 'to-verify' | 'verified' | 'dropped' | 'archived'

export interface GitHubRepository {
  githubId: number
  nodeId: string
  name: string
  fullName: string
  ownerLogin: string
  ownerAvatarUrl?: string
  htmlUrl: string
  description?: string
  homepage?: string
  topics: string[]
  primaryLanguage?: string
  licenseSpdx?: string
  fork: boolean
  isTemplate: boolean
  defaultBranch?: string
  starredAt?: string
  createdAt?: string
  updatedAt?: string
  pushedAt?: string
  archived: boolean
  disabled: boolean
  private: boolean
  visibility?: string
  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  size: number
  fetchedAt: string
  lastSeenAt: string
  snapshotId: string
}

export interface UserRepositoryMetadata {
  repositoryId: number
  intent: RepositoryIntent
  lifecycleStatus: RepositoryLifecycleStatus
  customTitle?: string
  customSummary?: string
  whyStarred?: string
  note?: string
  verificationSummary?: string
  useCases?: string
  alternatives?: string
  tags: string[]
  confirmedAt?: string
  lastReviewedAt?: string
  lastVerifiedAt?: string
}
