export type ImportStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ImportSnapshot {
  id: string
  status: ImportStatus
  startedAt: string
  completedAt?: string
  repositoryCount: number
  lastCompletedPage: number
  failedPage?: number
  accountLogin?: string
}

export interface AuthenticatedGitHubUser {
  id: number
  login: string
  name?: string
  avatarUrl: string
}
