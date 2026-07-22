export const DATABASE_NAME = 'star-inbox'
export const DATABASE_SCHEMA_VERSION = 2

export const DATABASE_STORES_V1 = {
  repositories:
    'githubId, fullName, starredAt, primaryLanguage, archived, pushedAt, fetchedAt, snapshotId',
  importStaging: '[snapshotId+githubId], snapshotId, githubId',
  userMetadata:
    'repositoryId, intent, lifecycleStatus, *tags, confirmedAt, lastReviewedAt, lastVerifiedAt',
  suggestions: '++id, repositoryId, source, generatedAt, *suggestedTags',
  importSnapshots: 'id, status, startedAt, completedAt, accountLogin',
} as const

export const DATABASE_STORES_V2 = {
  ...DATABASE_STORES_V1,
  actions:
    '++id, repositoryId, action, status, createdAt, updatedAt, [repositoryId+status]',
} as const

export const DATABASE_STORES = DATABASE_STORES_V2
