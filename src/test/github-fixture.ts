import {
  starredRepositorySchema,
  type StarredRepositoryResponse,
} from '../github/schemas'

export function createStarredRepositoryFixture(
  overrides: Record<string, unknown> = {},
): StarredRepositoryResponse {
  return starredRepositorySchema.parse({
    starred_at: '2026-07-01T12:00:00Z',
    repo: {
      id: 42,
      node_id: 'R_kgDOExample',
      name: 'star-inbox',
      full_name: 'example/star-inbox',
      owner: {
        login: 'example',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/example/star-inbox',
      description: 'Review GitHub stars locally.',
      homepage: null,
      topics: ['local-first', 'github'],
      language: 'TypeScript',
      license: { spdx_id: 'MIT' },
      fork: false,
      is_template: false,
      default_branch: 'main',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-07-20T00:00:00Z',
      pushed_at: '2026-07-19T00:00:00Z',
      archived: false,
      disabled: false,
      private: false,
      visibility: 'public',
      stargazers_count: 120,
      forks_count: 12,
      open_issues_count: 3,
      size: 2048,
      ...overrides,
    },
  })
}
