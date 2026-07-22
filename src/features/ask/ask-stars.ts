import { db, type StarInboxDatabase } from '../../db/database'
import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../../domain/repository'

export interface StarSearchResult {
  repository: GitHubRepository
  metadata?: UserRepositoryMetadata
  score: number
  reasons: string[]
}

const CONCEPTS: Array<{ pattern: RegExp; terms: string[]; label: string }> = [
  {
    pattern: /本地|离线|local|offline/i,
    terms: ['local', 'offline', 'self-hosted', 'on-premise'],
    label: '本地运行',
  },
  {
    pattern: /代码|编程|coding|code/i,
    terms: ['code', 'coding', 'developer', 'programming'],
    label: '编程开发',
  },
  {
    pattern: /智能体|agent/i,
    terms: ['agent', 'agents', 'agentic'],
    label: 'Agent',
  },
  {
    pattern: /工作流|workflow/i,
    terms: ['workflow', 'automation', 'orchestration'],
    label: '工作流',
  },
  {
    pattern: /终端|命令行|cli|terminal/i,
    terms: ['cli', 'terminal', 'command-line'],
    label: '命令行',
  },
  {
    pattern: /浏览器|browser|extension/i,
    terms: ['browser', 'extension', 'chrome', 'firefox'],
    label: '浏览器',
  },
  {
    pattern: /数据库|database|sql/i,
    terms: ['database', 'sql', 'postgres', 'sqlite'],
    label: '数据库',
  },
  {
    pattern: /windows/i,
    terms: ['windows', 'win32', 'powershell'],
    label: 'Windows',
  },
  {
    pattern: /自托管|self.?hosted/i,
    terms: ['self-hosted', 'selfhosted', 'docker'],
    label: 'Self-hosted',
  },
]

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.toLocaleLowerCase()))]
}

function querySignals(query: string) {
  const rawTerms = query
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}+#.-]+/u)
    .filter((term) => term.length >= 2 && !/^[\u4e00-\u9fff]+$/u.test(term))
  const concepts = CONCEPTS.filter(({ pattern }) => pattern.test(query))
  return {
    terms: unique([
      ...rawTerms,
      ...concepts.flatMap((concept) => concept.terms),
    ]),
    concepts,
  }
}

function includesTerm(value: string | undefined, term: string) {
  return value?.toLocaleLowerCase().includes(term) ?? false
}

function scoreRepository(
  repository: GitHubRepository,
  metadata: UserRepositoryMetadata | undefined,
  query: string,
): StarSearchResult | undefined {
  if (metadata?.lifecycleStatus === 'dropped') return undefined
  const signals = querySignals(query)
  if (!signals.terms.length) return undefined

  let score = 0
  const reasons = new Set<string>()
  const conceptReasons: string[] = []
  for (const term of signals.terms) {
    if (includesTerm(repository.fullName, term)) {
      score += 10
      reasons.add(`仓库名称匹配 ${term}`)
    }
    if (repository.topics.some((topic) => includesTerm(topic, term))) {
      score += 8
      reasons.add(`Topic 匹配 ${term}`)
    }
    if (metadata?.tags.some((tag) => includesTerm(tag, term))) {
      score += 9
      reasons.add(`你的标签匹配 ${term}`)
    }
    if (includesTerm(repository.primaryLanguage, term)) {
      score += 7
      reasons.add(`主语言匹配 ${term}`)
    }
    if (includesTerm(repository.description, term)) {
      score += 4
      reasons.add(`Description 匹配 ${term}`)
    }
    if (
      includesTerm(metadata?.customTitle, term) ||
      includesTerm(metadata?.customSummary, term) ||
      includesTerm(metadata?.whyStarred, term) ||
      includesTerm(metadata?.note, term) ||
      includesTerm(metadata?.verificationSummary, term)
    ) {
      score += 6
      reasons.add(`你的本地整理内容匹配 ${term}`)
    }
  }

  for (const concept of signals.concepts) {
    if (
      concept.terms.some(
        (term) =>
          repository.topics.some((topic) => includesTerm(topic, term)) ||
          includesTerm(repository.description, term) ||
          includesTerm(repository.name, term),
      )
    ) {
      conceptReasons.push(`符合“${concept.label}”条件`)
    }
  }

  if (!score) return undefined
  if (!repository.archived && !repository.disabled) score += 1
  const pushedAt = repository.pushedAt
    ? new Date(repository.pushedAt).getTime()
    : 0
  if (pushedAt > Date.now() - 180 * 24 * 60 * 60 * 1000) {
    score += 1
    reasons.add('最近半年仍有推送')
  }

  return {
    repository,
    metadata,
    score,
    reasons: [...conceptReasons, ...reasons].slice(0, 5),
  }
}

export async function searchMyStars(
  query: string,
  database: StarInboxDatabase = db,
  limit = 12,
): Promise<StarSearchResult[]> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []
  const [repositories, metadataRecords] = await Promise.all([
    database.repositories.toArray(),
    database.userMetadata.toArray(),
  ])
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )

  return repositories
    .flatMap((repository) => {
      const result = scoreRepository(
        repository,
        metadataByRepository.get(repository.githubId),
        normalizedQuery,
      )
      return result ? [result] : []
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.repository.stargazersCount - left.repository.stargazersCount,
    )
    .slice(0, Math.max(1, Math.min(limit, 30)))
}
