import {
  Archive,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Inbox,
  Languages,
  RefreshCw,
  Tags,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getDashboardStats,
  type DashboardStats,
} from '../features/dashboard/dashboard-stats'
import { DecisionCommandCenter } from '../features/dashboard/DecisionCommandCenter'
import { RepositoryLibrary } from '../features/library/RepositoryLibrary'

const emptyStats: DashboardStats = {
  total: 0,
  pendingReview: 0,
  reviewed: 0,
  verified: 0,
  archived: 0,
  staleOneYear: 0,
  starredLast30Days: 0,
  languages: [],
  topics: [],
}

interface LocationState {
  importedCount?: number
}

export function DashboardPage() {
  const location = useLocation()
  const locationState = location.state as LocationState | null
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void getDashboardStats().then((nextStats) => {
      if (mounted) {
        setStats(nextStats)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (stats.total === 0) {
    return (
      <section className="page-shell flex min-h-[68vh] items-center justify-center py-16">
        <div className="max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-paper text-signal shadow-[4px_4px_0_#ded8cd]">
            <Inbox size={28} />
          </div>
          <h1 className="mt-7 text-4xl font-black tracking-tight text-ink">
            收件箱还是空的
          </h1>
          <p className="mt-4 leading-7 text-muted">
            先用只读 Token 导入 GitHub Stars。数据将保存在当前浏览器中。
          </p>
          <Link to="/import" className="button-primary mt-7">
            前往导入 <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    )
  }

  const maxLanguageCount = stats.languages[0]?.count ?? 1

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-18">
      {locationState?.importedCount !== undefined && (
        <div className="mb-7 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          <CheckCircle2 size={18} />
          导入完成：{locationState.importedCount.toLocaleString()} 个 Stars
          已安全保存在此浏览器。
        </div>
      )}

      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow mb-4">YOUR LOCAL SNAPSHOT</div>
          <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
            Stars 总览
          </h1>
          <p className="mt-3 text-muted">
            这是本地快照，不会自动与 GitHub 同步。
          </p>
        </div>
        <Link to="/import" className="button-secondary self-start sm:self-auto">
          <RefreshCw size={16} /> 重新导入
        </Link>
      </div>

      <DecisionCommandCenter />

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={CircleGauge}
          label="全部 Stars"
          value={stats.total}
          note="本地仓库记录"
          tone="dark"
        />
        <MetricCard
          icon={Inbox}
          label="待回顾"
          value={stats.pendingReview}
          note="仍在 Inbox"
        />
        <MetricCard
          icon={CheckCircle2}
          label="已回顾"
          value={stats.reviewed}
          note="已有用户判断"
        />
        <MetricCard
          icon={CheckCircle2}
          label="已验证"
          value={stats.verified}
          note="进入长期知识"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <DashboardFact
          icon={CalendarPlus}
          label="最近 30 天收藏"
          value={stats.starredLast30Days}
        />
        <DashboardFact
          icon={Archive}
          label="上游已归档"
          value={stats.archived}
        />
        <DashboardFact
          icon={Clock3}
          label="一年未推送"
          value={stats.staleOneYear}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">LANGUAGES</p>
              <h2>主要语言</h2>
            </div>
            <Languages size={20} className="text-signal" />
          </div>
          <div className="mt-7 space-y-4">
            {stats.languages.length ? (
              stats.languages.map((language, index) => (
                <div
                  key={language.name}
                  className="grid grid-cols-[1.5rem_7rem_1fr_3rem] items-center gap-3"
                >
                  <span className="font-mono text-[10px] font-bold text-muted/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate text-sm font-bold text-ink">
                    {language.name}
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-signal"
                      style={{
                        width: `${(language.count / maxLanguageCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-xs font-bold text-muted">
                    {language.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">GitHub 没有返回语言信息。</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">TOPICS</p>
              <h2>高频 Topics</h2>
            </div>
            <Tags size={20} className="text-signal" />
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {stats.topics.length ? (
              stats.topics.map((topic, index) => (
                <span
                  key={topic.name}
                  className={
                    index < 3 ? 'topic-chip topic-chip-hot' : 'topic-chip'
                  }
                >
                  {topic.name}
                  <small>{topic.count}</small>
                </span>
              ))
            ) : (
              <p className="text-sm text-muted">GitHub 没有返回 Topics。</p>
            )}
          </div>
        </article>
      </div>

      <article className="mt-6 overflow-hidden rounded-2xl border border-ink bg-accent">
        <div className="grid gap-6 p-7 sm:grid-cols-[1fr_auto] sm:items-center lg:p-9">
          <div>
            <p className="font-mono text-[10px] font-black tracking-[0.18em] text-ink/60 uppercase">
              {stats.pendingReview ? 'NEXT ACTION' : 'INBOX ZERO'}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
              {stats.pendingReview
                ? `${stats.pendingReview.toLocaleString()} 个 Stars 等待你的判断`
                : '本地 Inbox 已经清空'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
              {stats.pendingReview
                ? '从最近收藏开始，每次只处理一个。收藏意图、标签、原因和私人备注只写入本地用户数据，不会被重新导入覆盖。'
                : '所有项目都已经有了你的判断。你可以进入已回顾视图继续查看和修改，本地结果刷新后仍然存在。'}
            </p>
          </div>
          <Link
            to={stats.pendingReview ? '/review' : '/review?view=reviewed'}
            className="button-primary"
          >
            <Inbox size={18} />
            {stats.pendingReview ? '开始回顾' : '查看已回顾'}
            <ArrowRight size={16} />
          </Link>
        </div>
      </article>

      <RepositoryLibrary
        onMetadataChange={() => {
          void getDashboardStats().then(setStats)
        }}
      />
    </section>
  )
}

function DashboardFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleGauge
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-paper/65 px-4 py-3 text-sm text-muted">
      <span className="inline-flex items-center gap-2 font-bold">
        <Icon size={15} /> {label}
      </span>
      <strong className="font-mono text-ink">{value.toLocaleString()}</strong>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <section
      className="page-shell py-10 sm:py-14 lg:py-18"
      aria-label="正在读取本地 Dashboard"
      aria-busy="true"
    >
      <div className="skeleton-block h-3 w-40 rounded-full" />
      <div className="skeleton-block mt-5 h-12 w-64 max-w-full rounded-xl" />
      <div className="skeleton-block mt-4 h-4 w-80 max-w-full rounded-full" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="skeleton-card">
            <div className="skeleton-block h-3 w-24 rounded-full" />
            <div className="skeleton-block mt-8 h-12 w-28 rounded-xl" />
            <div className="skeleton-block mt-4 h-3 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="skeleton-card h-72">
            <div className="skeleton-block h-4 w-32 rounded-full" />
            <div className="mt-10 space-y-5">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-4">
                  <div className="skeleton-block h-3 w-20 rounded-full" />
                  <div className="skeleton-block h-2 flex-1 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">正在读取浏览器中的 Stars 数据…</span>
    </section>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof CircleGauge
  label: string
  value: number
  note: string
  tone?: 'dark'
}) {
  return (
    <article
      className={
        tone === 'dark' ? 'metric-card metric-card-dark' : 'metric-card'
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-wide uppercase">
          {label}
        </span>
        <Icon size={17} />
      </div>
      <p className="mt-7 font-serif text-5xl leading-none">
        {value.toLocaleString()}
      </p>
      <p className="mt-3 text-xs opacity-65">{note}</p>
    </article>
  )
}
