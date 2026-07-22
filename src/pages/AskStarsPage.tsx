import {
  ArrowLeft,
  BookOpenText,
  Check,
  ExternalLink,
  FileSearch,
  FlaskConical,
  GitCompareArrows,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchMyStars, type StarSearchResult } from '../features/ask/ask-stars'
import { bulkUpdateRepositoryMetadata } from '../features/library/library-store'
import { githubClient, GitHubApiError } from '../github/client'
import { useTokenSession } from '../security/token-session'

const examples = [
  '本地运行的 AI 编程 Agent',
  '适合 Self-hosted 的工作流工具',
  'TypeScript 浏览器扩展框架',
]

export function AskStarsPage() {
  const [searchParams] = useSearchParams()
  const { token } = useTokenSession()
  const initialQuery = searchParams.get('q')?.trim() ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<StarSearchResult[]>([])
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set())
  const [readmes, setReadmes] = useState<Record<number, string>>({})
  const [readmeLoading, setReadmeLoading] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(Boolean(initialQuery))
  const [searched, setSearched] = useState(Boolean(initialQuery))
  const [message, setMessage] = useState('')

  async function runSearch(nextQuery = query) {
    const normalized = nextQuery.trim()
    if (!normalized) return
    setQuery(normalized)
    setLoading(true)
    setMessage('')
    try {
      setResults(await searchMyStars(normalized))
      setCompareIds(new Set())
      setSearched(true)
    } catch {
      setMessage('无法搜索本地 Stars，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialQuery) return
    let mounted = true
    void searchMyStars(initialQuery)
      .then((nextResults) => {
        if (mounted) setResults(nextResults)
      })
      .catch(() => {
        if (mounted) setMessage('无法搜索本地 Stars，请重试。')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [initialQuery])

  function toggleCompare(repositoryId: number) {
    setCompareIds((previous) => {
      const next = new Set(previous)
      if (next.has(repositoryId)) next.delete(repositoryId)
      else if (next.size < 4) next.add(repositoryId)
      return next
    })
  }

  async function loadReadme(result: StarSearchResult) {
    const repositoryId = result.repository.githubId
    if (result.repository.private && !token) {
      setMessage('私有仓库需要在当前页面内存中提供 Contents: Read Token。')
      return
    }
    setReadmeLoading((previous) => new Set(previous).add(repositoryId))
    setMessage('')
    try {
      const readme = await githubClient.getRepositoryReadme(
        result.repository.fullName,
        token ?? undefined,
      )
      setReadmes((previous) => ({
        ...previous,
        [repositoryId]: readme.content,
      }))
    } catch (error) {
      setMessage(
        error instanceof GitHubApiError
          ? error.message
          : 'README 加载失败，请重试。',
      )
    } finally {
      setReadmeLoading((previous) => {
        const next = new Set(previous)
        next.delete(repositoryId)
        return next
      })
    }
  }

  async function markForTry(result: StarSearchResult) {
    await bulkUpdateRepositoryMetadata([result.repository.githubId], {
      intent: 'try',
      lifecycleStatus: 'to-verify',
      addTags: result.repository.topics.slice(0, 4),
    })
    setMessage(`${result.repository.fullName} 已加入准备验证。`)
  }

  const comparison = useMemo(
    () =>
      results.filter((result) => compareIds.has(result.repository.githubId)),
    [compareIds, results],
  )

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-16">
      <Link
        to="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> 返回 Dashboard
      </Link>
      <div className="eyebrow mb-4">ASK MY STARS · LOCAL RETRIEVAL</div>
      <h1 className="max-w-4xl text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
        说出问题，不必先整理完整标签体系
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">
        搜索名称、Description、Topics、语言和你的本地笔记。结果是透明的关键词匹配，不是项目质量评分。
      </p>

      <form
        className="ask-search-box mt-8"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch()
        }}
      >
        <Search size={22} className="shrink-0 text-signal" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="例如：从我的 Stars 中找三个支持 Ollama 的本地代码 Agent"
          aria-label="描述你想找的项目"
        />
        <button
          type="submit"
          className="button-primary"
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Sparkles size={17} />
          )}
          搜索我的 Stars
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            className="library-mini-tag border border-line px-3 py-2"
            onClick={() => void runSearch(example)}
          >
            {example}
          </button>
        ))}
      </div>

      {message && (
        <div
          className="mt-5 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-bold text-ink"
          role="status"
        >
          {message}
        </div>
      )}

      {comparison.length > 0 && (
        <section
          className="mt-8 overflow-hidden rounded-2xl border border-ink bg-paper"
          aria-labelledby="comparison-title"
        >
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <p className="panel-kicker">SHORTLIST</p>
              <h2
                id="comparison-title"
                className="mt-1 text-2xl font-black text-ink"
              >
                候选对比 · {comparison.length} / 4
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setCompareIds(new Set())}
              aria-label="清空对比"
            >
              <X size={17} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>仓库</th>
                  <th>语言</th>
                  <th>License</th>
                  <th>最近推送</th>
                  <th>匹配依据</th>
                  <th>README 片段</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((result) => (
                  <tr key={result.repository.githubId}>
                    <td className="font-black text-ink">
                      {result.repository.fullName}
                    </td>
                    <td>{result.repository.primaryLanguage ?? '未知'}</td>
                    <td>{result.repository.licenseSpdx ?? '未知'}</td>
                    <td>
                      {result.repository.pushedAt?.slice(0, 10) ?? '未知'}
                    </td>
                    <td>{result.reasons.slice(0, 2).join('；')}</td>
                    <td>
                      {readmes[result.repository.githubId]?.slice(0, 220) ||
                        '尚未按需加载'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {results.map((result, index) => {
          const repositoryId = result.repository.githubId
          const comparing = compareIds.has(repositoryId)
          return (
            <article key={repositoryId} className="ask-result-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="panel-kicker">
                    MATCH {String(index + 1).padStart(2, '0')} · SCORE{' '}
                    {result.score}
                  </p>
                  <h2 className="mt-2 break-all text-xl font-black text-ink">
                    {result.repository.fullName}
                  </h2>
                </div>
                <button
                  type="button"
                  className={comparing ? 'button-primary' : 'button-secondary'}
                  onClick={() => toggleCompare(repositoryId)}
                  aria-pressed={comparing}
                  disabled={!comparing && compareIds.size >= 4}
                >
                  <GitCompareArrows size={15} />{' '}
                  {comparing ? '已加入' : '加入对比'}
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                {result.repository.description || '没有 Description。'}
              </p>
              <ul className="mt-4 space-y-1.5 text-xs font-bold text-ink/75">
                {result.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <Check size={13} className="mt-0.5 shrink-0 text-signal" />{' '}
                    {reason}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void loadReadme(result)}
                  disabled={readmeLoading.has(repositoryId)}
                >
                  {readmeLoading.has(repositoryId) ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <FileSearch size={15} />
                  )}
                  {readmes[repositoryId]
                    ? '重新加载 README'
                    : '按需加载 README'}
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void markForTry(result)}
                >
                  <FlaskConical size={15} /> 准备验证
                </button>
                <a
                  href={result.repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary"
                >
                  GitHub <ExternalLink size={14} />
                </a>
              </div>
              {readmes[repositoryId] && (
                <div className="mt-5 rounded-xl bg-[#20241f] p-4 text-xs leading-6 text-[#e8eadf]">
                  <div className="mb-2 flex items-center gap-2 font-black text-[#cbd09e]">
                    <BookOpenText size={14} /> README 仅保存在当前页面内存
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap">
                    {readmes[repositoryId].slice(0, 900)}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="review-empty-state">
          <Search size={30} />
          <h2>本地数据没有匹配结果</h2>
          <p>
            换用仓库名称、语言、Topic 或更具体的技术词。Ask My Stars
            不会伪造没有证据的候选。
          </p>
        </div>
      )}
    </section>
  )
}
