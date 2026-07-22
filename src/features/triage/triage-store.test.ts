import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { createRepositoryFixture } from '../../test/repository-fixture'
import {
  confirmTriageSuggestions,
  refreshTriageWorkspace,
} from './triage-store'

describe('triage store authority boundary', () => {
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

  it('writes rules only to suggestions until the user confirms', async () => {
    const database = new StarInboxDatabase(`triage-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture({ archived: true })
    await database.repositories.put(repository)

    const workspace = await refreshTriageWorkspace(
      database,
      new Date('2026-07-22T00:00:00.000Z'),
    )
    expect(workspace.counts.cleanup).toBe(1)
    expect(await database.suggestions.count()).toBe(1)
    expect(await database.userMetadata.count()).toBe(0)

    await confirmTriageSuggestions(
      [repository.githubId],
      database,
      new Date('2026-07-22T01:00:00.000Z'),
    )
    expect(await database.userMetadata.get(repository.githubId)).toMatchObject({
      lifecycleStatus: 'dropped',
      confirmedAt: '2026-07-22T01:00:00.000Z',
    })
    expect(
      (
        await refreshTriageWorkspace(
          database,
          new Date('2026-07-22T02:00:00.000Z'),
        )
      ).items,
    ).toHaveLength(0)
  })
})
