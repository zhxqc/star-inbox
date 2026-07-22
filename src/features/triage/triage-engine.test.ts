import { describe, expect, it } from 'vitest'
import { createRepositoryFixture } from '../../test/repository-fixture'
import { generateTriageRecommendations } from './triage-engine'

describe('generateTriageRecommendations', () => {
  const now = new Date('2026-07-22T00:00:00.000Z')

  it('creates explainable cleanup, rediscovery and reference suggestions', () => {
    const archived = createRepositoryFixture({
      githubId: 1,
      fullName: 'example/archived',
      archived: true,
    })
    const revived = createRepositoryFixture({
      githubId: 2,
      fullName: 'example/revived',
      starredAt: '2022-01-01T00:00:00.000Z',
      pushedAt: '2026-07-10T00:00:00.000Z',
      topics: ['unique-revived'],
    })
    const reference = createRepositoryFixture({
      githubId: 3,
      fullName: 'example/awesome-guide',
      description: 'An awesome reference guide.',
      topics: ['documentation'],
      starredAt: '2026-06-01T00:00:00.000Z',
      pushedAt: '2026-06-01T00:00:00.000Z',
    })

    const suggestions = generateTriageRecommendations(
      [archived, revived, reference],
      [],
      now,
    )

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repositoryId: 1, queueId: 'cleanup' }),
        expect.objectContaining({ repositoryId: 2, queueId: 'revived' }),
        expect.objectContaining({
          repositoryId: 3,
          suggestedIntent: 'reference',
        }),
      ]),
    )
    expect(suggestions.every((suggestion) => suggestion.reasons.length)).toBe(
      true,
    )
  })

  it('never generates a rule suggestion for user-confirmed metadata', () => {
    const repository = createRepositoryFixture({ archived: true })
    expect(
      generateTriageRecommendations(
        [repository],
        [
          {
            repositoryId: repository.githubId,
            intent: 'using',
            lifecycleStatus: 'verified',
            tags: ['keep'],
            confirmedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        now,
      ),
    ).toEqual([])
  })
})
