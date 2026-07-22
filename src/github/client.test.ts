import { describe, expect, it, vi } from 'vitest'
import { createStarredRepositoryFixture } from '../test/github-fixture'
import type { GitHubApiError } from './client'
import { GITHUB_API_VERSION, GitHubClient, parsePaginationLink } from './client'

describe('GitHubClient', () => {
  it('calls a receiver-sensitive fetch implementation with the browser global', async () => {
    const receiverSensitiveFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')

      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 42,
            login: 'star-inbox-user',
            name: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4',
          }),
          { status: 200 },
        ),
      )
    }) as unknown as typeof fetch
    const client = new GitHubClient(receiverSensitiveFetch)

    await expect(client.validateToken('receiver-test-token')).resolves.toEqual({
      id: 42,
      login: 'star-inbox-user',
      name: undefined,
      avatarUrl: 'https://avatars.githubusercontent.com/u/42?v=4',
    })
  })

  it('uses the timestamp media type, current API version and keeps token out of URL', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([createStarredRepositoryFixture()]), {
        status: 200,
        headers: {
          link: '<https://api.github.com/user/starred?page=2>; rel="next", <https://api.github.com/user/starred?page=3>; rel="last"',
        },
      }),
    )
    const client = new GitHubClient(fetchMock)

    await client.listStarredRepositoriesPage('super-secret-token', 1)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const requestUrl =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url?.url
    expect(requestUrl).not.toContain('super-secret-token')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer super-secret-token',
    )
    expect(new Headers(init?.headers).get('accept')).toBe(
      'application/vnd.github.star+json',
    )
    expect(new Headers(init?.headers).get('x-github-api-version')).toBe(
      GITHUB_API_VERSION,
    )
  })

  it('never includes the token in a failed request error', async () => {
    const client = new GitHubClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
    )

    await expect(
      client.validateToken('never-print-this'),
    ).rejects.toMatchObject({
      message: 'Token 无效或已过期，请重新检查。',
    } satisfies Partial<GitHubApiError>)
  })

  it('writes detailed network diagnostics without exposing the token', async () => {
    vi.useFakeTimers()
    const token = 'never-log-this-diagnostic-token'
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = new GitHubClient(
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError(`Failed to fetch ${token}`)),
    )

    try {
      const validation = expect(client.validateToken(token)).rejects.toThrow(
        '无法连接 GitHub，请检查网络后重试。',
      )
      await vi.runAllTimersAsync()
      await validation

      const diagnostics = JSON.stringify([
        ...info.mock.calls,
        ...warn.mock.calls,
        ...error.mock.calls,
      ])
      expect(diagnostics).toContain('request_started')
      expect(diagnostics).toContain('fetch_invoked')
      expect(diagnostics).toContain('fetch_rejected')
      expect(diagnostics).toContain('retry_scheduled')
      expect(diagnostics).toContain('request_failed')
      expect(diagnostics).toContain('[REDACTED]')
      expect(diagnostics).not.toContain(token)
      expect(diagnostics).not.toContain('Authorization')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })

  it('loads README on demand without placing the token in its URL or logs', async () => {
    const token = 'readme-secret-token'
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('# Useful project\n\nLocal-first.'))
    const client = new GitHubClient(fetchMock)

    try {
      await expect(
        client.getRepositoryReadme('example/star-inbox', token),
      ).resolves.toEqual({
        content: '# Useful project\n\nLocal-first.',
        truncated: false,
      })

      const [url, init] = fetchMock.mock.calls[0] ?? []
      const requestUrl =
        typeof url === 'string' ? url : url instanceof URL ? url.href : url?.url
      expect(requestUrl).toBe(
        'https://api.github.com/repos/example/star-inbox/readme',
      )
      expect(requestUrl).not.toContain(token)
      expect(new Headers(init?.headers).get('accept')).toBe(
        'application/vnd.github.raw+json',
      )
      expect(new Headers(init?.headers).get('authorization')).toBe(
        `Bearer ${token}`,
      )

      const diagnostics = JSON.stringify([
        ...info.mock.calls,
        ...warn.mock.calls,
        ...error.mock.calls,
      ])
      expect(diagnostics).toContain('readme_request_succeeded')
      expect(diagnostics).not.toContain(token)
      expect(diagnostics).not.toContain('Authorization')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('executes explicit star actions without exposing the token', async () => {
    const token = 'write-token-never-log'
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    const client = new GitHubClient(fetchMock)

    try {
      await client.unstarRepository('example/star-inbox', token)
      await client.starRepository('example/star-inbox', token)

      const [deleteUrl, deleteInit] = fetchMock.mock.calls[0] ?? []
      const [putUrl, putInit] = fetchMock.mock.calls[1] ?? []
      expect(deleteUrl).toBe(
        'https://api.github.com/user/starred/example/star-inbox',
      )
      expect(deleteInit?.method).toBe('DELETE')
      expect(putUrl).toBe(
        'https://api.github.com/user/starred/example/star-inbox',
      )
      expect(putInit?.method).toBe('PUT')
      expect(new Headers(deleteInit?.headers).get('authorization')).toBe(
        `Bearer ${token}`,
      )
      const diagnostics = JSON.stringify([
        ...info.mock.calls,
        ...warn.mock.calls,
        ...error.mock.calls,
      ])
      expect(diagnostics).toContain('action_request_succeeded')
      expect(diagnostics).not.toContain(token)
      expect(diagnostics).not.toContain('Authorization')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('treats GitHub 304 as an already-satisfied idempotent star action', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 304 }))
    const client = new GitHubClient(fetchMock)

    try {
      await expect(
        client.starRepository('example/star-inbox', 'memory-token'),
      ).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      info.mockRestore()
    }
  })
})

describe('parsePaginationLink', () => {
  it('extracts next and last pages from the Link header', () => {
    expect(
      parsePaginationLink(
        '<https://api.github.com/user/starred?per_page=100&page=2>; rel="next", <https://api.github.com/user/starred?per_page=100&page=9>; rel="last"',
      ),
    ).toEqual({ nextPage: 2, totalPages: 9 })
  })
})
