import {
  ArchiveX,
  ArrowRight,
  BrainCircuit,
  Gem,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getActionPlan } from '../actions/action-store'
import { getForgottenGems, type ForgottenGem } from '../gems/forgotten-gems'
import {
  refreshTriageWorkspace,
  type TriageWorkspace,
} from '../triage/triage-store'

export function DecisionCommandCenter() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [triage, setTriage] = useState<TriageWorkspace | null>(null)
  const [queuedActions, setQueuedActions] = useState(0)
  const [gems, setGems] = useState<ForgottenGem[]>([])

  useEffect(() => {
    let mounted = true
    void Promise.all([
      refreshTriageWorkspace(),
      getActionPlan(),
      getForgottenGems(undefined, new Date(), 3),
    ]).then(([nextTriage, actions, nextGems]) => {
      if (!mounted) return
      setTriage(nextTriage)
      setQueuedActions(
        actions.filter(({ action }) => action.status === 'queued').length,
      )
      setGems(nextGems)
    })
    return () => {
      mounted = false
    }
  }, [])

  const pendingDecisions = triage
    ? Object.values(triage.counts).reduce((total, value) => total + value, 0)
    : 0

  return (
    <section
      className="command-center mt-9"
      aria-labelledby="command-center-title"
    >
      <div className="command-center-main">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="panel-kicker text-accent">DECISION COMMAND CENTER</p>
            <h2
              id="command-center-title"
              className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl"
            >
              先处理问题，不先整理文件夹
            </h2>
          </div>
          <BrainCircuit size={28} className="shrink-0 text-accent" />
        </div>

        <form
          className="command-search mt-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim()) {
              void navigate(`/ask?q=${encodeURIComponent(query.trim())}`)
            }
          }}
        >
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="从我的 Stars 中找……"
            aria-label="搜索我的 Stars"
          />
          <button type="submit" disabled={!query.trim()}>
            Ask My Stars <ArrowRight size={15} />
          </button>
        </form>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <CommandMetric
            label="待你确认"
            value={triage ? pendingDecisions : undefined}
            icon={Sparkles}
            to="/triage"
          />
          <CommandMetric
            label="可能清理"
            value={triage?.counts.cleanup}
            icon={ArchiveX}
            to="/triage"
          />
          <CommandMetric
            label="待执行操作"
            value={triage ? queuedActions : undefined}
            icon={ShieldCheck}
            to="/actions"
          />
        </div>
      </div>

      <aside className="command-center-gems">
        <div className="flex items-center justify-between">
          <div>
            <p className="panel-kicker">TODAY’S GEMS</p>
            <h2 className="mt-2 text-xl font-black text-ink">值得重新看</h2>
          </div>
          <Gem size={20} className="text-signal" />
        </div>
        {!triage ? (
          <div className="grid min-h-44 place-items-center">
            <LoaderCircle size={22} className="animate-spin text-signal" />
          </div>
        ) : gems.length ? (
          <div className="mt-5 space-y-3">
            {gems.map((gem) => (
              <a
                key={gem.repository.githubId}
                href={gem.repository.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="command-gem-link"
              >
                <strong>{gem.repository.fullName}</strong>
                <small>{gem.reasons[0]}</small>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm leading-6 text-muted">
            暂时没有合适的旧收藏候选。
          </p>
        )}
        <Link
          to="/gems"
          className="button-secondary mt-5 w-full justify-center"
        >
          查看 Forgotten Gems <ArrowRight size={14} />
        </Link>
      </aside>
    </section>
  )
}

function CommandMetric({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string
  value?: number
  icon: typeof Sparkles
  to: string
}) {
  return (
    <Link to={to} className="command-metric">
      <span className="flex items-center justify-between gap-3">
        <Icon size={16} />
        <strong>{value === undefined ? '—' : value.toLocaleString()}</strong>
      </span>
      <small>{label}</small>
    </Link>
  )
}
