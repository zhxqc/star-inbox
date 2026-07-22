import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getForgottenGems,
  type ForgottenGem,
} from '../features/gems/forgotten-gems'
import { bulkUpdateRepositoryMetadata } from '../features/library/library-store'

export function ForgottenGemsPage() {
  const [gems, setGems] = useState<ForgottenGem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadGems() {
    setLoading(true)
    try {
      setGems(await getForgottenGems())
    } catch {
      setMessage('无法生成 Forgotten Gems。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    void getForgottenGems()
      .then((nextGems) => {
        if (mounted) setGems(nextGems)
      })
      .catch(() => {
        if (mounted) setMessage('无法生成 Forgotten Gems。')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function markForTry(gem: ForgottenGem) {
    await bulkUpdateRepositoryMetadata([gem.repository.githubId], {
      intent: 'try',
      lifecycleStatus: 'to-verify',
      addTags: gem.repository.topics.slice(0, 4),
    })
    setMessage(`${gem.repository.fullName} 已加入准备验证。`)
    await loadGems()
  }

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Link
            to="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> 返回 Dashboard
          </Link>
          <div className="eyebrow mb-4">FORGOTTEN GEMS · DAILY LOCAL PICK</div>
          <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
            旧收藏里，今天值得重新看什么？
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            每天根据收藏时间、最近推送和你的验证状态生成少量候选，不需要后台同步，也不把
            Star 数当成质量评分。
          </p>
        </div>
        <button
          type="button"
          className="button-secondary self-start"
          onClick={() => void loadGems()}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          重新生成
        </button>
      </div>

      {message && (
        <div
          className="mt-6 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-bold text-ink"
          role="status"
        >
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-96 place-items-center">
          <LoaderCircle size={30} className="animate-spin text-signal" />
        </div>
      ) : (
        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gems.map((gem, index) => (
            <article key={gem.repository.githubId} className="gem-card">
              <div className="flex items-center justify-between">
                <span className="gem-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Sparkles size={18} className="text-signal" />
              </div>
              <h2 className="mt-6 break-all text-xl font-black text-ink">
                {gem.repository.fullName}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                {gem.repository.description || '没有 Description。'}
              </p>
              <ul className="mt-5 space-y-2 text-xs font-bold text-ink/75">
                {gem.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <CalendarClock
                      size={14}
                      className="mt-0.5 shrink-0 text-signal"
                    />{' '}
                    {reason}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void markForTry(gem)}
                >
                  <FlaskConical size={15} /> 准备验证
                </button>
                <a
                  href={gem.repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary"
                >
                  GitHub <ExternalLink size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && gems.length === 0 && (
        <div className="review-empty-state">
          <CheckCircle2 size={30} />
          <h2>暂时没有合适的旧项目</h2>
          <p>随着收藏时间和验证状态变化，候选会在之后重新计算。</p>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-ink bg-accent p-6 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="panel-kicker">NEXT STEP</p>
          <h2 className="mt-2 text-xl font-black text-ink">
            需要找具体工具时，不必等待每日推荐
          </h2>
        </div>
        <Link to="/ask" className="button-primary mt-4 sm:mt-0">
          <Star size={16} /> Ask My Stars
        </Link>
      </div>
    </section>
  )
}
