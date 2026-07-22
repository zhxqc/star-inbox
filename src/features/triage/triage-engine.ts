import type {
  GitHubRepository,
  RepositoryIntent,
  RepositoryLifecycleStatus,
  UserRepositoryMetadata,
} from '../../domain/repository'
import type {
  RepositorySuggestion,
  TriageQueueId,
} from '../../domain/suggestion'

const DAY = 24 * 60 * 60 * 1000
const REFERENCE_TERMS = [
  'awesome',
  'guide',
  'tutorial',
  'resource',
  'reference',
  'examples',
  'documentation',
  'roadmap',
]
const TRY_TERMS = [
  'tool',
  'cli',
  'agent',
  'framework',
  'platform',
  'server',
  'app',
  'automation',
  'workflow',
  'extension',
  'self-hosted',
]

export interface TriageRecommendation extends RepositorySuggestion {
  queueId: TriageQueueId
}

function timestamp(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}

function ageInDays(value: string | undefined, now: Date) {
  const parsed = timestamp(value)
  return parsed === undefined
    ? undefined
    : Math.max(0, Math.floor((now.getTime() - parsed) / DAY))
}

function repositoryText(repository: GitHubRepository) {
  return [
    repository.name,
    repository.description,
    repository.primaryLanguage,
    ...repository.topics,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

function matchesAny(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term))
}

function suggestedTags(repository: GitHubRepository) {
  const values = [repository.primaryLanguage, ...repository.topics.slice(0, 4)]
  const seen = new Set<string>()
  return values.filter((value): value is string => {
    if (!value) return false
    const identity = value.toLocaleLowerCase()
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function similarGroupKeys(repositories: GitHubRepository[]) {
  const buckets = new Map<string, number[]>()

  for (const repository of repositories) {
    const topics = [
      ...new Set(repository.topics.map((topic) => topic.toLowerCase())),
    ]
      .sort()
      .slice(0, 3)
    if (topics.length < 2) continue
    const key = `${repository.primaryLanguage?.toLowerCase() ?? 'unknown'}:${topics
      .slice(0, 2)
      .join('+')}`
    const values = buckets.get(key) ?? []
    values.push(repository.githubId)
    buckets.set(key, values)
  }

  const byRepository = new Map<number, string>()
  for (const [key, repositoryIds] of buckets) {
    if (repositoryIds.length < 2) continue
    for (const repositoryId of repositoryIds) {
      byRepository.set(repositoryId, key)
    }
  }
  return byRepository
}

function recommendation(
  repository: GitHubRepository,
  values: {
    queueId: TriageQueueId
    intent?: RepositoryIntent
    lifecycleStatus?: RepositoryLifecycleStatus
    reasons: string[]
    ruleIds: string[]
    confidence: number
    groupKey?: string
  },
  generatedAt: string,
): TriageRecommendation {
  return {
    repositoryId: repository.githubId,
    suggestedIntent: values.intent,
    suggestedLifecycleStatus: values.lifecycleStatus,
    suggestedTags: suggestedTags(repository),
    matchedRuleIds: values.ruleIds,
    reasons: values.reasons,
    confidence: values.confidence,
    source: 'rule',
    ruleSetVersion: 'triage-v1',
    generatedAt,
    queueId: values.queueId,
    groupKey: values.groupKey,
  }
}

export function generateTriageRecommendations(
  repositories: GitHubRepository[],
  metadataRecords: UserRepositoryMetadata[],
  now = new Date(),
): TriageRecommendation[] {
  const metadataByRepository = new Map(
    metadataRecords.map((metadata) => [metadata.repositoryId, metadata]),
  )
  const similarGroups = similarGroupKeys(repositories)
  const generatedAt = now.toISOString()
  const recommendations: TriageRecommendation[] = []

  for (const repository of repositories) {
    const metadata = metadataByRepository.get(repository.githubId)
    if (metadata?.confirmedAt) continue

    const pushedAge = ageInDays(repository.pushedAt, now)
    const starredAge = ageInDays(repository.starredAt, now)
    const text = repositoryText(repository)
    const referenceMatches = matchesAny(text, REFERENCE_TERMS)
    const tryMatches = matchesAny(text, TRY_TERMS)
    const groupKey = similarGroups.get(repository.githubId)

    if (repository.archived || repository.disabled || (pushedAge ?? 0) > 730) {
      const reasons: string[] = []
      const ruleIds: string[] = []
      if (repository.archived) {
        reasons.push('GitHub 将仓库标记为 Archived')
        ruleIds.push('github-archived')
      }
      if (repository.disabled) {
        reasons.push('GitHub 将仓库标记为 Disabled')
        ruleIds.push('github-disabled')
      }
      if ((pushedAge ?? 0) > 730) {
        reasons.push(`最近一次推送距今约 ${Math.floor(pushedAge! / 365)} 年`)
        ruleIds.push('stale-two-years')
      }
      recommendations.push(
        recommendation(
          repository,
          {
            queueId: 'cleanup',
            intent: 'uncertain',
            lifecycleStatus: 'dropped',
            reasons,
            ruleIds,
            confidence:
              repository.archived || repository.disabled ? 0.96 : 0.76,
          },
          generatedAt,
        ),
      )
      continue
    }

    if ((starredAge ?? 0) > 365 && pushedAge !== undefined && pushedAge <= 90) {
      recommendations.push(
        recommendation(
          repository,
          {
            queueId: 'revived',
            intent: 'try',
            lifecycleStatus: 'to-verify',
            reasons: ['收藏超过一年，但最近 90 天内仍有代码推送'],
            ruleIds: ['old-star-recent-push'],
            confidence: 0.82,
          },
          generatedAt,
        ),
      )
      continue
    }

    if (groupKey) {
      recommendations.push(
        recommendation(
          repository,
          {
            queueId: 'similar',
            intent: 'try',
            lifecycleStatus: 'to-verify',
            reasons: ['与其他收藏共享主要语言和多个 Topics，适合放在一起比较'],
            ruleIds: ['shared-language-topics'],
            confidence: 0.74,
            groupKey,
          },
          generatedAt,
        ),
      )
      continue
    }

    if (referenceMatches.length) {
      recommendations.push(
        recommendation(
          repository,
          {
            queueId: 'try',
            intent: 'reference',
            lifecycleStatus: 'reviewed',
            reasons: [
              `名称、Description 或 Topics 命中参考资料特征：${referenceMatches.slice(0, 3).join('、')}`,
            ],
            ruleIds: ['reference-keywords'],
            confidence: 0.78,
          },
          generatedAt,
        ),
      )
      continue
    }

    if (tryMatches.length || repository.isTemplate) {
      const reasons = tryMatches.length
        ? [`项目特征命中可试用工具：${tryMatches.slice(0, 3).join('、')}`]
        : ['这是一个 GitHub Template 仓库']
      recommendations.push(
        recommendation(
          repository,
          {
            queueId: 'try',
            intent: 'try',
            lifecycleStatus: 'to-verify',
            reasons,
            ruleIds: [repository.isTemplate ? 'template' : 'try-keywords'],
            confidence: 0.72,
          },
          generatedAt,
        ),
      )
      continue
    }

    const missingSignals = [
      !repository.description ? 'Description' : '',
      repository.topics.length === 0 ? 'Topics' : '',
      !repository.primaryLanguage ? '主语言' : '',
    ].filter(Boolean)
    recommendations.push(
      recommendation(
        repository,
        {
          queueId: 'uncertain',
          intent: 'uncertain',
          lifecycleStatus: 'reviewed',
          reasons: [
            missingSignals.length
              ? `可用信号不足：缺少 ${missingSignals.join('、')}`
              : '现有元数据不足以给出可靠建议',
          ],
          ruleIds: ['insufficient-signals'],
          confidence: 0.35,
        },
        generatedAt,
      ),
    )
  }

  return recommendations
}
