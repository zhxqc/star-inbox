import { z, ZodError, type ZodType } from 'zod'
import type { AuthenticatedGitHubUser } from '../domain/import'
import {
  authenticatedUserSchema,
  starredRepositoriesPageSchema,
  type StarredRepositoryResponse,
} from './schemas'

const GITHUB_API_BASE_URL = 'https://api.github.com'
export const GITHUB_API_VERSION = '2026-03-10'
export const GITHUB_PAGE_SIZE = 100
const MAX_ATTEMPTS = 3
const MAX_README_CHARACTERS = 120_000
const GITHUB_DIAGNOSTIC_PREFIX = '[Star Inbox][GitHub API]'

type DiagnosticLevel = 'info' | 'warn' | 'error'

interface DiagnosticDetails {
  apiVersion?: string
  attempt?: number
  browserOnline?: boolean
  delayMs?: number
  elapsedMs?: number
  errorMessage?: string
  errorName?: string
  maxAttempts?: number
  method?: 'GET' | 'PUT' | 'DELETE'
  origin?: string
  path?: string
  responseType?: ResponseType
  status?: number
  targetOrigin?: string
}

let diagnosticSequence = 0

function createDiagnosticId() {
  diagnosticSequence += 1
  return `github-${Date.now().toString(36)}-${diagnosticSequence}`
}

function getBrowserNetworkContext(): Pick<
  DiagnosticDetails,
  'browserOnline' | 'origin'
> {
  return {
    browserOnline:
      typeof navigator === 'undefined' ? undefined : navigator.onLine,
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  }
}

function redactSecret(value: string, secret: string) {
  return secret ? value.replaceAll(secret, '[REDACTED]') : value
}

function describeFetchError(error: unknown, token: string) {
  if (!(error instanceof Error)) {
    return { errorName: 'UnknownError' }
  }

  return {
    errorName: error.name,
    errorMessage: redactSecret(error.message, token),
  }
}

function logGitHubDiagnostic(
  level: DiagnosticLevel,
  requestId: string,
  event: string,
  details: DiagnosticDetails = {},
) {
  const payload = {
    requestId,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  }

  console[level](
    `${GITHUB_DIAGNOSTIC_PREFIX} ${event}`,
    JSON.stringify(payload),
  )
}

export interface StarredRepositoriesPage {
  repositories: StarredRepositoryResponse[]
  nextPage?: number
  totalPages?: number
}

export interface RepositoryReadme {
  content: string
  truncated: boolean
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

function parsePageFromLink(link: string, relation: 'next' | 'last') {
  for (const part of link.split(',')) {
    if (!part.includes(`rel="${relation}"`)) continue
    const urlMatch = /<([^>]+)>/.exec(part)
    if (!urlMatch?.[1]) return undefined
    const page = new URL(urlMatch[1]).searchParams.get('page')
    if (!page) return undefined
    const parsed = Number(page)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
  }
  return undefined
}

export function parsePaginationLink(link: string | null): {
  nextPage?: number
  totalPages?: number
} {
  if (!link) return {}
  return {
    nextPage: parsePageFromLink(link, 'next'),
    totalPages: parsePageFromLink(link, 'last'),
  }
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout)
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      },
      { once: true },
    )
  })
}

function repositoryApiPath(fullName: string, suffix = '') {
  const [owner, repositoryName, ...extraParts] = fullName.split('/')
  if (!owner || !repositoryName || extraParts.length) {
    throw new GitHubApiError('仓库名称格式无效。')
  }
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}${suffix}`
}

export class GitHubClient {
  private readonly fetchImplementation: typeof fetch

  constructor(fetchImplementation: typeof fetch = globalThis.fetch) {
    this.fetchImplementation = fetchImplementation.bind(globalThis)
  }

  async validateToken(
    token: string,
    signal?: AbortSignal,
  ): Promise<AuthenticatedGitHubUser> {
    const response = await this.request(
      '/user',
      token,
      authenticatedUserSchema,
      signal,
      'application/vnd.github+json',
    )
    return {
      id: response.id,
      login: response.login,
      name: response.name ?? undefined,
      avatarUrl: response.avatar_url,
    }
  }

  async listStarredRepositoriesPage(
    token: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<StarredRepositoriesPage> {
    const query = new URLSearchParams({
      per_page: String(GITHUB_PAGE_SIZE),
      page: String(page),
      sort: 'created',
      direction: 'desc',
    })
    const { data, headers } = await this.requestWithHeaders(
      `/user/starred?${query.toString()}`,
      token,
      starredRepositoriesPageSchema,
      signal,
      'application/vnd.github.star+json',
    )

    return {
      repositories: data,
      ...parsePaginationLink(headers.get('link')),
    }
  }

  async getRepositoryReadme(
    fullName: string,
    token?: string,
    signal?: AbortSignal,
  ): Promise<RepositoryReadme> {
    const path = repositoryApiPath(fullName, '/readme')
    const requestId = createDiagnosticId()
    const requestStartedAt = performance.now()
    const requestDetails = {
      apiVersion: GITHUB_API_VERSION,
      method: 'GET' as const,
      path,
      targetOrigin: GITHUB_API_BASE_URL,
      maxAttempts: MAX_ATTEMPTS,
      ...getBrowserNetworkContext(),
    }

    logGitHubDiagnostic(
      'info',
      requestId,
      'readme_request_started',
      requestDetails,
    )

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const headers = new Headers({
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      })
      if (token) headers.set('Authorization', `Bearer ${token}`)

      let response: Response
      logGitHubDiagnostic('info', requestId, 'readme_fetch_invoked', {
        ...requestDetails,
        attempt,
      })

      try {
        response = await this.fetchImplementation(
          `${GITHUB_API_BASE_URL}${path}`,
          { method: 'GET', headers, signal },
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          logGitHubDiagnostic('warn', requestId, 'readme_request_aborted', {
            ...requestDetails,
            attempt,
          })
          throw error
        }

        const errorDetails = describeFetchError(error, token ?? '')
        logGitHubDiagnostic('error', requestId, 'readme_fetch_rejected', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          ...errorDetails,
        })
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 500
          logGitHubDiagnostic('warn', requestId, 'readme_retry_scheduled', {
            ...requestDetails,
            attempt,
            delayMs,
          })
          await abortableDelay(delayMs, signal)
          continue
        }
        throw new GitHubApiError(
          '无法连接 GitHub 读取 README，请检查网络后重试。',
          undefined,
          true,
        )
      }

      logGitHubDiagnostic('info', requestId, 'readme_response_received', {
        ...requestDetails,
        attempt,
        elapsedMs: Math.round(performance.now() - requestStartedAt),
        responseType: response.type,
        status: response.status,
      })

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 700
          logGitHubDiagnostic('warn', requestId, 'readme_retry_scheduled', {
            ...requestDetails,
            attempt,
            delayMs,
            status: response.status,
          })
          await abortableDelay(delayMs, signal)
          continue
        }

        const message =
          response.status === 401
            ? 'Token 无效或已过期，无法读取 README。'
            : response.status === 403
              ? 'GitHub 拒绝读取 README；私有仓库需要 Contents 读取权限。'
              : response.status === 404
                ? '仓库没有 README，或当前 Token 无权访问。'
                : `README 请求失败（${response.status}）。`
        logGitHubDiagnostic('error', requestId, 'readme_http_error', {
          ...requestDetails,
          attempt,
          status: response.status,
        })
        throw new GitHubApiError(message, response.status, retryable)
      }

      try {
        const content = z.string().parse(await response.text())
        const truncated = content.length > MAX_README_CHARACTERS
        logGitHubDiagnostic('info', requestId, 'readme_request_succeeded', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          status: response.status,
        })
        return {
          content: truncated
            ? content.slice(0, MAX_README_CHARACTERS)
            : content,
          truncated,
        }
      } catch {
        logGitHubDiagnostic('error', requestId, 'readme_response_read_failed', {
          ...requestDetails,
          attempt,
          status: response.status,
        })
        throw new GitHubApiError('无法读取 GitHub 返回的 README。')
      }
    }

    throw new GitHubApiError('README 请求未完成。')
  }

  async unstarRepository(
    fullName: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const repositoryPath = repositoryApiPath(fullName)
    await this.requestNoContent(
      `/user/starred${repositoryPath.slice('/repos'.length)}`,
      token,
      'DELETE',
      signal,
    )
  }

  async starRepository(
    fullName: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const repositoryPath = repositoryApiPath(fullName)
    await this.requestNoContent(
      `/user/starred${repositoryPath.slice('/repos'.length)}`,
      token,
      'PUT',
      signal,
    )
  }

  private async requestNoContent(
    path: string,
    token: string,
    method: 'PUT' | 'DELETE',
    signal?: AbortSignal,
  ) {
    const requestId = createDiagnosticId()
    const requestStartedAt = performance.now()
    const requestDetails = {
      apiVersion: GITHUB_API_VERSION,
      method,
      path,
      targetOrigin: GITHUB_API_BASE_URL,
      maxAttempts: MAX_ATTEMPTS,
      ...getBrowserNetworkContext(),
    }

    logGitHubDiagnostic(
      'info',
      requestId,
      'action_request_started',
      requestDetails,
    )

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response
      logGitHubDiagnostic('info', requestId, 'action_fetch_invoked', {
        ...requestDetails,
        attempt,
      })

      try {
        response = await this.fetchImplementation(
          `${GITHUB_API_BASE_URL}${path}`,
          {
            method,
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': GITHUB_API_VERSION,
            },
            signal,
          },
        )
      } catch (error) {
        const errorDetails = describeFetchError(error, token)
        if (error instanceof DOMException && error.name === 'AbortError') {
          logGitHubDiagnostic('warn', requestId, 'action_request_aborted', {
            ...requestDetails,
            attempt,
            ...errorDetails,
          })
          throw error
        }

        logGitHubDiagnostic('error', requestId, 'action_fetch_rejected', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          ...errorDetails,
        })
        if (attempt < MAX_ATTEMPTS) {
          await abortableDelay(attempt * 500, signal)
          continue
        }
        throw new GitHubApiError(
          '无法连接 GitHub 执行操作，请检查网络后重试。',
          undefined,
          true,
        )
      }

      logGitHubDiagnostic('info', requestId, 'action_response_received', {
        ...requestDetails,
        attempt,
        elapsedMs: Math.round(performance.now() - requestStartedAt),
        responseType: response.type,
        status: response.status,
      })

      // GitHub documents 304 for the idempotent Star endpoint as “not
      // modified”; the requested final state is already satisfied.
      if (response.ok || response.status === 304) {
        logGitHubDiagnostic('info', requestId, 'action_request_succeeded', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          status: response.status,
        })
        return
      }

      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < MAX_ATTEMPTS) {
        await abortableDelay(attempt * 700, signal)
        continue
      }

      const message =
        response.status === 401
          ? 'Token 无效或已过期，无法执行 GitHub 操作。'
          : response.status === 403
            ? 'GitHub 拒绝了写入请求，请检查 Starring 读写权限。'
            : response.status === 404
              ? '仓库不存在，或当前 Token 无权访问。'
              : `GitHub 操作失败（${response.status}）。`
      logGitHubDiagnostic('error', requestId, 'action_http_error', {
        ...requestDetails,
        attempt,
        status: response.status,
      })
      throw new GitHubApiError(message, response.status, retryable)
    }

    throw new GitHubApiError('GitHub 操作未完成。')
  }

  private async request<T>(
    path: string,
    token: string,
    schema: ZodType<T>,
    signal: AbortSignal | undefined,
    accept: string,
  ): Promise<T> {
    return (await this.requestWithHeaders(path, token, schema, signal, accept))
      .data
  }

  private async requestWithHeaders<T>(
    path: string,
    token: string,
    schema: ZodType<T>,
    signal: AbortSignal | undefined,
    accept: string,
  ): Promise<{ data: T; headers: Headers }> {
    const requestId = createDiagnosticId()
    const requestStartedAt = performance.now()
    const requestDetails = {
      apiVersion: GITHUB_API_VERSION,
      method: 'GET' as const,
      path,
      targetOrigin: GITHUB_API_BASE_URL,
      maxAttempts: MAX_ATTEMPTS,
      ...getBrowserNetworkContext(),
    }

    logGitHubDiagnostic('info', requestId, 'request_started', requestDetails)

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response
      logGitHubDiagnostic('info', requestId, 'fetch_invoked', {
        ...requestDetails,
        attempt,
      })

      try {
        response = await this.fetchImplementation(
          `${GITHUB_API_BASE_URL}${path}`,
          {
            method: 'GET',
            headers: {
              Accept: accept,
              Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': GITHUB_API_VERSION,
            },
            signal,
          },
        )
      } catch (error) {
        const errorDetails = describeFetchError(error, token)
        if (error instanceof DOMException && error.name === 'AbortError') {
          logGitHubDiagnostic('warn', requestId, 'request_aborted', {
            ...requestDetails,
            attempt,
            elapsedMs: Math.round(performance.now() - requestStartedAt),
            ...errorDetails,
          })
          throw error
        }

        logGitHubDiagnostic('error', requestId, 'fetch_rejected', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          ...errorDetails,
        })

        if (attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 500
          logGitHubDiagnostic('warn', requestId, 'retry_scheduled', {
            ...requestDetails,
            attempt,
            delayMs,
          })
          await abortableDelay(delayMs, signal)
          continue
        }

        logGitHubDiagnostic('error', requestId, 'request_failed', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          ...errorDetails,
        })
        throw new GitHubApiError(
          '无法连接 GitHub，请检查网络后重试。',
          undefined,
          true,
        )
      }

      logGitHubDiagnostic('info', requestId, 'response_received', {
        ...requestDetails,
        attempt,
        elapsedMs: Math.round(performance.now() - requestStartedAt),
        responseType: response.type,
        status: response.status,
      })

      if (!response.ok) {
        const retryable =
          response.status === 429 ||
          response.status >= 500 ||
          (response.status === 403 && response.headers.has('retry-after'))
        if (retryable && attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(response.headers.get('retry-after'))
          const delayMs = Number.isFinite(retryAfter)
            ? Math.max(retryAfter * 1000, 500)
            : attempt * 700
          logGitHubDiagnostic('warn', requestId, 'retry_scheduled', {
            ...requestDetails,
            attempt,
            delayMs,
            status: response.status,
          })
          await abortableDelay(delayMs, signal)
          continue
        }

        const message =
          response.status === 401
            ? 'Token 无效或已过期，请重新检查。'
            : response.status === 403
              ? 'GitHub 拒绝了请求，请检查 Starring 读取权限或速率限制。'
              : `GitHub 请求失败（${response.status}）。`
        logGitHubDiagnostic('error', requestId, 'http_error', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          status: response.status,
        })
        throw new GitHubApiError(message, response.status, retryable)
      }

      try {
        const json: unknown = await response.json()
        const data = schema.parse(json)
        logGitHubDiagnostic('info', requestId, 'request_succeeded', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          status: response.status,
        })
        return { data, headers: response.headers }
      } catch (error) {
        if (error instanceof ZodError) {
          logGitHubDiagnostic('error', requestId, 'schema_validation_failed', {
            ...requestDetails,
            attempt,
            elapsedMs: Math.round(performance.now() - requestStartedAt),
            status: response.status,
          })
          throw new GitHubApiError('GitHub 返回了无法识别的数据格式。')
        }
        logGitHubDiagnostic('error', requestId, 'response_read_failed', {
          ...requestDetails,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          status: response.status,
        })
        throw new GitHubApiError('无法读取 GitHub 返回的数据。')
      }
    }

    throw new GitHubApiError('GitHub 请求未完成。')
  }
}

export const githubClient = new GitHubClient()
