import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from './database'
import { DATABASE_SCHEMA_VERSION, DATABASE_STORES_V1 } from './schema'

describe('database migrations', () => {
  const names: string[] = []

  afterEach(async () => {
    await Promise.all(names.map((name) => Dexie.delete(name)))
    names.length = 0
  })

  it('upgrades a V1 database without losing user metadata', async () => {
    const name = `migration-${crypto.randomUUID()}`
    names.push(name)
    const legacy = new Dexie(name)
    legacy.version(1).stores(DATABASE_STORES_V1)
    await legacy.table('userMetadata').put({
      repositoryId: 42,
      intent: 'using',
      lifecycleStatus: 'verified',
    })
    legacy.close()

    const upgraded = new StarInboxDatabase(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(DATABASE_SCHEMA_VERSION)
    expect(await upgraded.userMetadata.get(42)).toMatchObject({
      repositoryId: 42,
      intent: 'using',
      lifecycleStatus: 'verified',
      tags: [],
    })
    expect(await upgraded.actions.count()).toBe(0)
    upgraded.close()
  })
})
