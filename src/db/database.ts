import Dexie, { type EntityTable, type Table } from 'dexie'
import type { GitHubStarActionRecord } from '../domain/action'
import type { ImportSnapshot } from '../domain/import'
import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../domain/repository'
import type { RepositorySuggestion } from '../domain/suggestion'
import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_STORES_V1,
  DATABASE_STORES_V2,
} from './schema'
import { migrateDatabaseV1ToV2 } from './migrations'

export class StarInboxDatabase extends Dexie {
  repositories!: EntityTable<GitHubRepository, 'githubId'>
  importStaging!: Table<GitHubRepository, [string, number]>
  userMetadata!: EntityTable<UserRepositoryMetadata, 'repositoryId'>
  suggestions!: EntityTable<RepositorySuggestion, 'id'>
  importSnapshots!: EntityTable<ImportSnapshot, 'id'>
  actions!: EntityTable<GitHubStarActionRecord, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores(DATABASE_STORES_V1)
    this.version(DATABASE_SCHEMA_VERSION)
      .stores(DATABASE_STORES_V2)
      .upgrade(migrateDatabaseV1ToV2)
  }
}

export const db = new StarInboxDatabase()
