import { afterEach, describe, expect, it } from 'vitest'
import { StarInboxDatabase } from '../../db/database'
import { createRepositoryFixture } from '../../test/repository-fixture'
import { searchMyStars } from './ask-stars'

describe('searchMyStars', () => {
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

  it('maps a Chinese task query to explainable local metadata matches', async () => {
    const database = new StarInboxDatabase(`ask-${crypto.randomUUID()}`)
    databases.push(database)
    await database.repositories.bulkPut([
      createRepositoryFixture({
        githubId: 1,
        fullName: 'example/local-agent',
        description: 'A local coding agent with Ollama support.',
        topics: ['agent', 'ollama', 'local'],
      }),
      createRepositoryFixture({
        githubId: 2,
        fullName: 'example/css-library',
        description: 'CSS components.',
        topics: ['css'],
      }),
    ])

    const results = await searchMyStars('本地 Ollama 编程 Agent', database)
    expect(results[0]?.repository.fullName).toBe('example/local-agent')
    expect(results[0]?.reasons).toContain('符合“本地运行”条件')
  })

  it('does not recommend repositories the user explicitly dropped', async () => {
    const database = new StarInboxDatabase(`ask-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createRepositoryFixture({
      githubId: 3,
      fullName: 'example/dropped-agent',
      topics: ['agent', 'local'],
    })
    await database.repositories.put(repository)
    await database.userMetadata.put({
      repositoryId: repository.githubId,
      intent: 'uncertain',
      lifecycleStatus: 'dropped',
      tags: [],
      confirmedAt: '2026-07-22T00:00:00.000Z',
    })

    await expect(searchMyStars('local agent', database)).resolves.toEqual([])
  })
})
