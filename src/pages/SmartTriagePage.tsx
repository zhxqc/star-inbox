import {
  ArchiveX,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitCompareArrows,
  Inbox,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Tags,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TriageQueueId } from '../domain/suggestion'
import { queueGitHubActions } from '../features/actions/action-store'
import {
  confirmTriageSuggestions,
  refreshTriageWorkspace,
  type TriageWorkspace,
  type TriageWorkspaceItem,
} from '../features/triage/triage-store'

const queues: Array<{
  id: TriageQueueId
  label: string
  description: string
  icon: typeof ArchiveX
}> = [
  {
    id: 'cleanup',
    label: '可能可以清理',
    description: '已归档、已停用或两年以上没有推送',
    icon: ArchiveX,
  },
  {
    id: 'similar',
    label: '相似项目',
    description: '共享主要语言和多个 Topics，适合放在一起比较',
    icon: GitCompareArrows,
  },
  {
    id: 'revived',
    label: '旧收藏仍活跃',
    description: '收藏超过一年，最近 90 天仍有推送',
    icon: Clock3,
  },
  {
    id: 'try',
    label: '可快速确认',
    description: '规则可以解释其更像工具还是参考资料',
    icon: Sparkles,
  },
  {
    id: 'uncertain',
    label: '需要你判断',
    description: '现有元数据不足，系统不替你做决定',
    icon: Inbox,
  },
]

const TRIAGE_PAGE_SIZE = 50

function confidenceLabel(value?: number) {
  if (value === undefined) return '未评分'
  if (value >= 0.85) return '高置信'
  if (value >= 0.65) return '中置信'
  return '低置信'
}

export function SmartTriagePage() {
  const [workspace, setWorkspace] = useState<TriageWorkspace | null>(null)
  const [activeQueue, setActiveQueue] = useState<TriageQueueId>('cleanup')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function loadWorkspace() {
    setLoading(true)
    setMessage('')
    try {
      setWorkspace(await refreshTriageWorkspace())
    } catch {
      setMessage('无法生成本地整理建议，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    void refreshTriageWorkspace()
      .then((nextWorkspace) => {
        if (mounted) setWorkspace(nextWorkspace)
      })
      .catch(() => {
        if (mounted) setMessage('无法生成本地整理建议，请重试。')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const queueItems = useMemo(
    () =>
      workspace?.items.filter(
        (item) => item.suggestion.queueId === activeQueue,
      ) ?? [],
    [activeQueue, workspace],
  )
  const totalPages = Math.max(
    1,
    Math.ceil(queueItems.length / TRIAGE_PAGE_SIZE),
  )
  const safePage = Math.min(page, totalPages)
  const pageItems = queueItems.slice(
    (safePage - 1) * TRIAGE_PAGE_SIZE,
    safePage * TRIAGE_PAGE_SIZE,
  )
  const selectedQueueIds = queueItems
    .map((item) => item.repository.githubId)
    .filter((id) => selected.has(id))

  function toggleRepository(repositoryId: number) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(repositoryId)) next.delete(repositoryId)
      else next.add(repositoryId)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((previous) => {
      const next = new Set(previous)
      const allSelected = pageItems.every((item) =>
        next.has(item.repository.githubId),
      )
      for (const item of pageItems) {
        if (allSelected) next.delete(item.repository.githubId)
        else next.add(item.repository.githubId)
      }
      return next
    })
  }

  async function confirmSelected(queueRemoteCleanup = false) {
    if (!selectedQueueIds.length || busy) return
    setBusy(true)
    setMessage('')
    try {
      if (queueRemoteCleanup && activeQueue === 'cleanup') {
        await queueGitHubActions(
          selectedQueueIds,
          'unstar',
          '用户在 Smart Triage 中确认清理建议',
        )
      }
      const confirmed = await confirmTriageSuggestions(selectedQueueIds)
      setSelected(new Set())
      setWorkspace(await refreshTriageWorkspace())
      setMessage(
        queueRemoteCleanup
          ? `已确认 ${confirmed.length} 个项目，并加入 Action Center。`
          : `已确认 ${confirmed.length} 个建议。`,
      )
    } catch {
      setMessage('批量确认失败，本地数据没有被完整修改，请重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Link
            to="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> 返回 Dashboard
          </Link>
          <div className="eyebrow mb-4">
            SMART TRIAGE · EXPLAINABLE BY DEFAULT
          </div>
          <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
            不逐个打标签，按问题批量决定
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            规则只生成候选和理由。只有你点击确认，结果才会进入用户数据；清理建议也不会直接修改
            GitHub。
          </p>
        </div>
        <button
          type="button"
          className="button-secondary self-start"
          onClick={() => void loadWorkspace()}
          disabled={loading || busy}
        >
          {loading ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          重新分析
        </button>
      </div>

      <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {queues.map((queue) => {
          const Icon = queue.icon
          const active = activeQueue === queue.id
          return (
            <button
              key={queue.id}
              type="button"
              className={`triage-queue-card ${active ? 'triage-queue-card-active' : ''}`}
              onClick={() => {
                setActiveQueue(queue.id)
                setPage(1)
                setSelected(new Set())
              }}
              aria-pressed={active}
            >
              <span className="flex items-center justify-between">
                <Icon size={18} />
                <strong className="font-serif text-3xl">
                  {workspace?.counts[queue.id] ?? 0}
                </strong>
              </span>
              <span className="mt-5 block text-sm font-black text-ink">
                {queue.label}
              </span>
              <small className="mt-1.5 block text-left leading-5 text-muted">
                {queue.description}
              </small>
            </button>
          )
        })}
      </div>

      {message && (
        <div
          className="mt-6 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-bold text-ink"
          role="status"
        >
          {message}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-ink bg-white/75 shadow-[6px_6px_0_rgba(28,33,29,0.08)]">
        <div className="flex flex-col justify-between gap-4 border-b border-line bg-paper p-4 sm:flex-row sm:items-center">
          <label className="inline-flex items-center gap-3 text-sm font-black text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-signal"
              checked={
                pageItems.length > 0 &&
                pageItems.every((item) =>
                  selected.has(item.repository.githubId),
                )
              }
              onChange={toggleAllVisible}
            />
            选择当前页 · 当前队列已选 {selectedQueueIds.length} /{' '}
            {queueItems.length}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={!selectedQueueIds.length || busy}
              onClick={() => void confirmSelected(false)}
            >
              <CheckCircle2 size={16} /> 确认系统建议
            </button>
            {activeQueue === 'cleanup' && (
              <button
                type="button"
                className="button-primary"
                disabled={!selectedQueueIds.length || busy}
                onClick={() => void confirmSelected(true)}
              >
                {busy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <ArchiveX size={16} />
                )}
                确认并加入清理计划
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center text-muted">
            <LoaderCircle size={28} className="animate-spin text-signal" />
          </div>
        ) : queueItems.length ? (
          <>
            <div className="divide-y divide-line">
              {pageItems.map((item) => (
                <TriageRow
                  key={item.repository.githubId}
                  item={item}
                  selected={selected.has(item.repository.githubId)}
                  onToggle={() => toggleRepository(item.repository.githubId)}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line bg-paper p-4 text-xs font-bold text-muted">
              <span>
                第 {safePage} / {totalPages} 页 · 每页最多 {TRIAGE_PAGE_SIZE} 条
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="library-page-button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ArrowLeft size={14} /> 上一页
                </button>
                <button
                  type="button"
                  className="library-page-button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  下一页 <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <Check size={30} className="mx-auto text-emerald-700" />
              <h2 className="mt-4 text-xl font-black text-ink">
                这个队列已经处理完
              </h2>
              <p className="mt-2 text-sm text-muted">
                可以切换到其他队列继续批量确认。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-7 flex justify-end">
        <Link to="/actions" className="button-primary">
          <Layers3 size={17} /> 打开 Action Center
        </Link>
      </div>
    </section>
  )
}

function TriageRow({
  item,
  selected,
  onToggle,
}: {
  item: TriageWorkspaceItem
  selected: boolean
  onToggle: () => void
}) {
  const { repository, suggestion } = item
  return (
    <article className={`triage-row ${selected ? 'triage-row-selected' : ''}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-signal"
        checked={selected}
        onChange={onToggle}
        aria-label={`选择 ${repository.fullName}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-all text-sm font-black text-ink">
            {repository.fullName}
          </h2>
          <span className="library-status-pill">
            {confidenceLabel(suggestion.confidence)}
          </span>
          {suggestion.suggestedIntent && (
            <span className="library-mini-tag">
              {suggestion.suggestedIntent}
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">
          {repository.description || '没有 Description。'}
        </p>
        <ul className="mt-3 space-y-1 text-xs font-semibold text-ink/75">
          {suggestion.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-signal" />
              {reason}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tags size={13} className="text-muted" />
          {suggestion.suggestedTags.length ? (
            suggestion.suggestedTags.map((tag) => (
              <span key={tag} className="library-mini-tag">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">没有候选标签</span>
          )}
        </div>
      </div>
      <a
        href={repository.htmlUrl}
        target="_blank"
        rel="noreferrer"
        className="button-secondary shrink-0"
        aria-label={`在 GitHub 打开 ${repository.fullName}`}
      >
        GitHub <ExternalLink size={14} />
      </a>
    </article>
  )
}
