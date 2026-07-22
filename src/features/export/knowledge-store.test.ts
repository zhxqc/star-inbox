import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { createRepositoryFixture } from '../../test/repository-fixture'
import { getKnowledgeWorkspace, saveVerification } from './knowledge-store'

describe('knowledge verification store', () => {
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

  it('promotes an explicitly verified project without changing GitHub data', async () => {
    const database = new StarInboxDatabase(`knowledge-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture()
    await database.repositories.put(repository)
    await database.userMetadata.put({
      repositoryId: repository.githubId,
      intent: 'try',
      lifecycleStatus: 'to-verify',
      tags: ['Local-first'],
    })

    await saveVerification(
      {
        repositoryId: repository.githubId,
        customSummary: '本地工作台',
        verificationSummary: '验证通过。',
        tags: ['Local-first', 'local-first', 'GitHub'],
      },
      database,
      new Date('2026-07-22T00:00:00.000Z'),
    )

    const workspace = await getKnowledgeWorkspace(database)
    expect(workspace.toVerify).toHaveLength(0)
    expect(workspace.verified[0]?.metadata).toMatchObject({
      lifecycleStatus: 'verified',
      verificationSummary: '验证通过。',
      tags: ['Local-first', 'GitHub'],
      lastVerifiedAt: '2026-07-22T00:00:00.000Z',
    })
    expect(await database.repositories.get(repository.githubId)).toEqual(
      repository,
    )
  })

  it('rejects an empty conclusion instead of creating a false verification', async () => {
    const database = new StarInboxDatabase(`knowledge-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture()
    await database.repositories.put(repository)

    await expect(
      saveVerification(
        {
          repositoryId: repository.githubId,
          verificationSummary: '   ',
          tags: [],
        },
        database,
      ),
    ).rejects.toThrow('验证结论不能为空。')
    expect(await database.userMetadata.count()).toBe(0)
  })
})
