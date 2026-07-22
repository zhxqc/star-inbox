import { describe, expect, it } from 'vitest'
import { createStarredRepositoryFixture } from '../test/github-fixture'
import { starredRepositorySchema } from './schemas'

describe('GitHub transport schemas', () => {
  it('rejects non-HTTPS and non-GitHub repository links', () => {
    const fixture = createStarredRepositoryFixture()

    expect(() =>
      starredRepositorySchema.parse({
        ...fixture,
        repo: { ...fixture.repo, html_url: 'javascript:alert(1)' },
      }),
    ).toThrow()
    expect(() =>
      starredRepositorySchema.parse({
        ...fixture,
        repo: { ...fixture.repo, html_url: 'https://example.com/lookalike' },
      }),
    ).toThrow()
  })
})
