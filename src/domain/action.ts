export type GitHubStarAction = 'unstar' | 'star'

export type GitHubStarActionStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface GitHubStarActionRecord {
  id?: number
  repositoryId: number
  repositoryFullNameAtQueue: string
  action: GitHubStarAction
  status: GitHubStarActionStatus
  reason: string
  attemptCount: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  failureCode?: string
}
