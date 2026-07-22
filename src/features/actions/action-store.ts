import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubStarAction,
  GitHubStarActionRecord,
} from '../../domain/action'
import type { GitHubRepository } from '../../domain/repository'
import { githubClient, GitHubApiError } from '../../github/client'

export interface ActionPlanEntry {
  action: GitHubStarActionRecord
  repository?: GitHubRepository
}

export interface ActionExecutionProgress {
  completed: number
  total: number
  currentRepository?: string
}

interface GitHubActionClient {
  unstarRepository(
    fullName: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<void>
  starRepository(
    fullName: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<void>
}

function normalizeReason(reason: string) {
  return reason.trim().slice(0, 240) || '用户加入行动计划'
}

export async function queueGitHubActions(
  repositoryIds: number[],
  action: GitHubStarAction,
  reason: string,
  database: StarInboxDatabase = db,
  now = new Date(),
): Promise<GitHubStarActionRecord[]> {
  const uniqueIds = [...new Set(repositoryIds)]
  if (!uniqueIds.length) return []

  return database.transaction(
    'rw',
    database.repositories,
    database.actions,
    async () => {
      const repositories = await database.repositories.bulkGet(uniqueIds)
      const existingActions = await database.actions
        .where('repositoryId')
        .anyOf(uniqueIds)
        .and(
          (record) => record.status === 'queued' || record.status === 'running',
        )
        .toArray()
      const existingKeys = new Set(
        existingActions.map(
          (record) => `${record.repositoryId}:${record.action}`,
        ),
      )
      const queuedAt = now.toISOString()
      const records: GitHubStarActionRecord[] = []

      for (let index = 0; index < uniqueIds.length; index += 1) {
        const repository = repositories[index]
        if (!repository) continue
        const key = `${repository.githubId}:${action}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)

        records.push({
          repositoryId: repository.githubId,
          repositoryFullNameAtQueue: repository.fullName,
          action,
          status: 'queued',
          reason: normalizeReason(reason),
          attemptCount: 0,
          createdAt: queuedAt,
          updatedAt: queuedAt,
        })
      }

      if (records.length) {
        const ids = await database.actions.bulkAdd(records, { allKeys: true })
        records.forEach((record, index) => {
          record.id = ids[index]
        })
      }
      return records
    },
  )
}

export async function getActionPlan(
  database: StarInboxDatabase = db,
): Promise<ActionPlanEntry[]> {
  const actions = await database.actions
    .orderBy('createdAt')
    .reverse()
    .toArray()
  const repositories = await database.repositories.bulkGet(
    actions.map((action) => action.repositoryId),
  )
  return actions.map((action, index) => ({
    action,
    repository: repositories[index],
  }))
}

export async function recoverInterruptedActions(
  database: StarInboxDatabase = db,
  now = new Date(),
) {
  const updatedAt = now.toISOString()
  return database.actions.where('status').equals('running').modify({
    status: 'cancelled',
    failureCode: 'interrupted_result_unknown',
    updatedAt,
    completedAt: updatedAt,
  })
}

export async function removeQueuedAction(
  actionId: number,
  database: StarInboxDatabase = db,
) {
  const action = await database.actions.get(actionId)
  if (!action || action.status !== 'queued') return false
  await database.actions.delete(actionId)
  return true
}

export async function retryFailedActions(
  actionIds: number[],
  database: StarInboxDatabase = db,
  now = new Date(),
) {
  const ids = [...new Set(actionIds)]
  const updatedAt = now.toISOString()
  await database.transaction('rw', database.actions, async () => {
    for (const id of ids) {
      const action = await database.actions.get(id)
      if (!action || action.status !== 'failed') continue
      await database.actions.update(id, {
        status: 'queued',
        updatedAt,
        completedAt: undefined,
        failureCode: undefined,
      })
    }
  })
}

function failureCode(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'cancelled_result_unknown'
  }
  if (error instanceof GitHubApiError) {
    return error.status ? `github_http_${error.status}` : 'github_network_error'
  }
  return 'unexpected_error'
}

function shouldHaltAfterFailure(error: unknown, remoteSucceeded: boolean) {
  if (remoteSucceeded) return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (!(error instanceof GitHubApiError)) return true
  return (
    error.status === undefined ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 429 ||
    error.status >= 500
  )
}

export async function executeActionPlan(
  actionIds: number[],
  token: string,
  options: {
    database?: StarInboxDatabase
    client?: GitHubActionClient
    signal?: AbortSignal
    onProgress?: (progress: ActionExecutionProgress) => void
    now?: () => Date
  } = {},
) {
  const database = options.database ?? db
  const client = options.client ?? githubClient
  const ids = [...new Set(actionIds)]
  const records = (await database.actions.bulkGet(ids)).filter(
    (record): record is GitHubStarActionRecord => Boolean(record),
  )
  const executable = records.filter((record) => record.status === 'queued')
  const results: GitHubStarActionRecord[] = []

  options.onProgress?.({ completed: 0, total: executable.length })

  for (let index = 0; index < executable.length; index += 1) {
    const record = executable[index]
    if (!record) continue
    if (options.signal?.aborted) break
    if (record.id === undefined) continue

    const repository = await database.repositories.get(record.repositoryId)
    const startedAt = (options.now?.() ?? new Date()).toISOString()
    if (!repository) {
      await database.actions.update(record.id, {
        status: 'failed',
        failureCode: 'repository_missing_locally',
        attemptCount: record.attemptCount + 1,
        updatedAt: startedAt,
        completedAt: startedAt,
      })
      const failed = await database.actions.get(record.id)
      if (failed) results.push(failed)
      options.onProgress?.({
        completed: index + 1,
        total: executable.length,
      })
      continue
    }

    await database.actions.update(record.id, {
      status: 'running',
      attemptCount: record.attemptCount + 1,
      updatedAt: startedAt,
      failureCode: undefined,
    })
    options.onProgress?.({
      completed: index,
      total: executable.length,
      currentRepository: repository.fullName,
    })

    let remoteSucceeded = false
    try {
      if (record.action === 'unstar') {
        await client.unstarRepository(
          repository.fullName,
          token,
          options.signal,
        )
      } else {
        await client.starRepository(repository.fullName, token, options.signal)
      }
      remoteSucceeded = true

      const completedAt = (options.now?.() ?? new Date()).toISOString()
      await database.transaction(
        'rw',
        database.actions,
        database.userMetadata,
        async () => {
          await database.actions.update(record.id, {
            status: 'succeeded',
            updatedAt: completedAt,
            completedAt,
            failureCode: undefined,
          })

          const existing = await database.userMetadata.get(repository.githubId)
          if (record.action === 'unstar') {
            await database.userMetadata.put({
              ...existing,
              repositoryId: repository.githubId,
              intent: existing?.intent ?? 'uncertain',
              lifecycleStatus: 'dropped',
              tags: existing?.tags ?? [],
              confirmedAt: existing?.confirmedAt ?? completedAt,
              lastReviewedAt: completedAt,
            })
          } else if (existing?.lifecycleStatus === 'dropped') {
            await database.userMetadata.put({
              ...existing,
              lifecycleStatus: 'reviewed',
              lastReviewedAt: completedAt,
            })
          }
        },
      )
    } catch (error) {
      const completedAt = (options.now?.() ?? new Date()).toISOString()
      await database.actions.update(record.id, {
        status:
          remoteSucceeded ||
          (error instanceof DOMException && error.name === 'AbortError')
            ? 'cancelled'
            : 'failed',
        failureCode: remoteSucceeded
          ? 'remote_succeeded_local_update_failed'
          : failureCode(error),
        updatedAt: completedAt,
        completedAt,
      })

      const result = await database.actions.get(record.id)
      if (result) results.push(result)
      options.onProgress?.({
        completed: index + 1,
        total: executable.length,
      })
      if (shouldHaltAfterFailure(error, remoteSucceeded)) break
      continue
    }

    const result = await database.actions.get(record.id)
    if (result) results.push(result)
    options.onProgress?.({
      completed: index + 1,
      total: executable.length,
    })
  }

  return results
}
