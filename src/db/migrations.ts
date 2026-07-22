import type { Transaction } from 'dexie'
import type { UserRepositoryMetadata } from '../domain/repository'
import { DATABASE_SCHEMA_VERSION } from './schema'

export async function migrateDatabaseV1ToV2(transaction: Transaction) {
  await transaction
    .table<UserRepositoryMetadata, number>('userMetadata')
    .toCollection()
    .modify((metadata) => {
      metadata.tags ??= []
    })
}

/**
 * Dexie migrations are declared in database.ts. Keeping the current version
 * exported here gives future migrations one explicit, reviewable entry point.
 */
export const currentDatabaseSchemaVersion = DATABASE_SCHEMA_VERSION
