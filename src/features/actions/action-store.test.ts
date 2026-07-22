import { afterEach, describe, expect, it, vi } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { GitHubApiError } from '../../github/client'
import { createRepositoryFixture } from '../../test/repository-fixture'
import {
  executeActionPlan,
  getActionPlan,
  queueGitHubActions,
  recoverInterruptedActions,
  retryFailedActions,
} from './action-store'

describe('GitHub action plan', () => {
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

  it('deduplicates queued actions and persists only safe execution state', async () => {
    const database = new StarInboxDatabase(`actions-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture()
    await database.repositories.put(repository)

    const first = await queueGitHubActions(
      [repository.githubId, repository.githubId],
      'unstar',
      '已归档',
      database,
    )
    const duplicate = await queueGitHubActions(
      [repository.githubId],
      'unstar',
      '重复操作',
      database,
    )
    expect(first).toHaveLength(1)
    expect(duplicate).toHaveLength(0)

    const unstarRepository = vi.fn().mockResolvedValue(undefined)
    const token = 'action-token-must-not-persist'
    await executeActionPlan([first[0]!.id!], token, {
      database,
      client: {
        unstarRepository,
        starRepository: vi.fn().mockResolvedValue(undefined),
      },
    })

    expect(unstarRepository).toHaveBeenCalledWith(
      repository.fullName,
      token,
      undefined,
    )
    expect((await getActionPlan(database))[0]?.action.status).toBe('succeeded')
    expect(await database.userMetadata.get(repository.githubId)).toMatchObject({
      lifecycleStatus: 'dropped',
    })
    expect(
      JSON.stringify({
        actions: await database.actions.toArray(),
        metadata: await database.userMetadata.toArray(),
        repositories: await database.repositories.toArray(),
      }),
    ).not.toContain(token)
  })

  it('marks interrupted writes as unknown instead of silently retrying them', async () => {
    const database = new StarInboxDatabase(`actions-${crypto.randomUUID()}`)
    databases.push(database)
    await database.actions.add({
      repositoryId: 42,
      repositoryFullNameAtQueue: 'example/star-inbox',
      action: 'unstar',
      status: 'running',
      reason: 'test',
      attemptCount: 1,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
    })

    await recoverInterruptedActions(
      database,
      new Date('2026-07-22T01:00:00.000Z'),
    )
    expect((await database.actions.toArray())[0]).toMatchObject({
      status: 'cancelled',
      failureCode: 'interrupted_result_unknown',
      completedAt: '2026-07-22T01:00:00.000Z',
    })

    const actionId = (await database.actions.toArray())[0]!.id!
    await retryFailedActions([actionId], database)
    expect((await database.actions.get(actionId))?.status).toBe('cancelled')
  })

  it('does not call a remote success a retryable failure when local persistence fails', async () => {
    const database = new StarInboxDatabase(`actions-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture()
    await database.repositories.put(repository)
    const [queued] = await queueGitHubActions(
      [repository.githubId],
      'unstar',
      'test local failure',
      database,
    )
    if (!queued?.id) throw new Error('expected queued action id')
    const unstarRepository = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(database.userMetadata, 'put').mockRejectedValueOnce(
      new Error('simulated IndexedDB failure'),
    )

    await executeActionPlan([queued.id], 'memory-token', {
      database,
      client: {
        unstarRepository,
        starRepository: vi.fn().mockResolvedValue(undefined),
      },
    })

    expect(unstarRepository).toHaveBeenCalledOnce()
    const action = await database.actions.get(queued.id)
    expect(action).toMatchObject({
      status: 'cancelled',
      failureCode: 'remote_succeeded_local_update_failed',
    })
    await retryFailedActions([queued.id], database)
    expect((await database.actions.get(queued.id))?.status).toBe('cancelled')
  })

  it('halts a large plan after an authorization failure and leaves later work queued', async () => {
    const database = new StarInboxDatabase(`actions-${crypto.randomUUID()}`)
    databases.push(database)
    const repositories = [
      createRepositoryFixture({ githubId: 1, fullName: 'example/one' }),
      createRepositoryFixture({ githubId: 2, fullName: 'example/two' }),
    ]
    await database.repositories.bulkPut(repositories)
    const queued = await queueGitHubActions(
      repositories.map((repository) => repository.githubId),
      'unstar',
      'test authorization failure',
      database,
    )
    const secondId = queued[1]?.id
    if (!secondId) throw new Error('expected second queued action id')
    const unstarRepository = vi
      .fn()
      .mockRejectedValue(new GitHubApiError('forbidden', 403))

    const results = await executeActionPlan(
      queued.map((action) => action.id!),
      'memory-token',
      {
        database,
        client: {
          unstarRepository,
          starRepository: vi.fn().mockResolvedValue(undefined),
        },
      },
    )

    expect(unstarRepository).toHaveBeenCalledOnce()
    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('failed')
    expect((await database.actions.get(secondId))?.status).toBe('queued')
  })

  it('brings a restored Star back into the reviewed local library', async () => {
    const database = new StarInboxDatabase(`actions-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture()
    await database.repositories.put(repository)
    await database.userMetadata.put({
      repositoryId: repository.githubId,
      intent: 'uncertain',
      lifecycleStatus: 'dropped',
      tags: [],
      confirmedAt: '2026-07-22T00:00:00.000Z',
    })
    const [queued] = await queueGitHubActions(
      [repository.githubId],
      'star',
      'restore',
      database,
    )
    if (!queued?.id) throw new Error('expected queued restore action id')

    await executeActionPlan([queued.id], 'memory-token', {
      database,
      client: {
        unstarRepository: vi.fn().mockResolvedValue(undefined),
        starRepository: vi.fn().mockResolvedValue(undefined),
      },
    })

    expect(await database.userMetadata.get(repository.githubId)).toMatchObject({
      lifecycleStatus: 'reviewed',
    })
  })
})
