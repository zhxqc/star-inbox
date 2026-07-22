import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  GitPullRequestArrow,
  History,
  KeyRound,
  LoaderCircle,
  Play,
  RefreshCcw,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GITHUB_WRITE_TOKEN_TEMPLATE_URL } from '../components/TokenGuide'
import type { GitHubStarActionStatus } from '../domain/action'
import {
  executeActionPlan,
  getActionPlan,
  queueGitHubActions,
  recoverInterruptedActions,
  removeQueuedAction,
  retryFailedActions,
  type ActionExecutionProgress,
  type ActionPlanEntry,
} from '../features/actions/action-store'
import { useTokenSession } from '../security/token-session'

const ACTION_PAGE_SIZE = 50

const statusLabels: Record<GitHubStarActionStatus, string> = {
  queued: '等待执行',
  running: '执行中',
  succeeded: '执行成功',
  failed: '执行失败',
  cancelled: '结果待确认',
}

function failureText(code?: string) {
  if (!code) return ''
  if (code === 'cancelled_result_unknown')
    return '取消发生在网络请求期间，请先到 GitHub 核对状态。'
  if (code === 'interrupted_result_unknown')
    return '页面在执行期间中断，请先到 GitHub 核对状态。'
  if (code === 'remote_succeeded_local_update_failed')
    return 'GitHub 已返回成功，但本地状态保存失败。请先核对 GitHub，不要直接重试。'
  if (code === 'repository_missing_locally') return '本地仓库记录不存在。'
  if (code === 'github_network_error') return '网络连接失败。'
  if (code.startsWith('github_http_'))
    return `GitHub 返回 ${code.replace('github_http_', '')}。`
  return '执行时发生未预期错误。'
}

export function ActionCenterPage() {
  const { token: sessionToken, setToken } = useTokenSession()
  const [entries, setEntries] = useState<ActionPlanEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [tokenInput, setTokenInput] = useState('')
  const [actionMode, setActionMode] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<ActionExecutionProgress>({
    completed: 0,
    total: 0,
  })
  const abortController = useRef<AbortController | null>(null)

  async function loadPlan() {
    await recoverInterruptedActions()
    const nextEntries = await getActionPlan()
    setEntries(nextEntries)
    setSelected(new Set())
    setPage(1)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    void recoverInterruptedActions()
      .then(() => getActionPlan())
      .then((nextEntries) => {
        if (!mounted) return
        setEntries(nextEntries)
        setSelected(new Set())
      })
      .catch(() => {
        if (mounted) setMessage('无法读取本地行动计划。')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
      abortController.current?.abort()
    }
  }, [])

  const counts = useMemo(() => {
    const result: Record<GitHubStarActionStatus, number> = {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    }
    for (const entry of entries) result[entry.action.status] += 1
    return result
  }, [entries])
  const selectedQueued = entries.filter(
    ({ action }) =>
      action.id !== undefined &&
      selected.has(action.id) &&
      action.status === 'queued',
  )
  const totalPages = Math.max(1, Math.ceil(entries.length / ACTION_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleEntries = entries.slice(
    (safePage - 1) * ACTION_PAGE_SIZE,
    safePage * ACTION_PAGE_SIZE,
  )
  const effectiveToken = tokenInput.trim() || sessionToken || ''
  const ready =
    actionMode &&
    confirmation.trim() === 'EXECUTE' &&
    Boolean(effectiveToken) &&
    selectedQueued.length > 0 &&
    !executing

  function toggleAction(actionId: number) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(actionId)) next.delete(actionId)
      else next.add(actionId)
      return next
    })
  }

  async function executeSelected() {
    if (!ready) return
    setExecuting(true)
    setMessage('')
    const controller = new AbortController()
    abortController.current = controller
    if (tokenInput.trim()) {
      setToken(tokenInput)
      setTokenInput('')
    }
    try {
      const results = await executeActionPlan(
        selectedQueued.map(({ action }) => action.id!),
        effectiveToken,
        {
          signal: controller.signal,
          onProgress: setProgress,
        },
      )
      const succeeded = results.filter(
        (result) => result.status === 'succeeded',
      ).length
      const failed = results.length - succeeded
      const untouched = selectedQueued.length - results.length
      setMessage(
        `本次完成 ${succeeded} 个操作${failed ? `，${failed} 个需要检查` : ''}${untouched ? `；已熔断，${untouched} 个仍在等待` : ''}。`,
      )
      setConfirmation('')
      setActionMode(false)
      await loadPlan()
    } catch {
      setMessage(
        '行动计划执行器发生本地错误；没有完成的项目仍保留在计划中，请检查后重试。',
      )
    } finally {
      abortController.current = null
      setExecuting(false)
    }
  }

  async function removeSelected() {
    await Promise.all(
      selectedQueued.map(({ action }) => removeQueuedAction(action.id!)),
    )
    setMessage(`已从计划中移除 ${selectedQueued.length} 个尚未执行的操作。`)
    await loadPlan()
  }

  async function retryFailures() {
    const ids = entries.flatMap(({ action }) =>
      action.id !== undefined && action.status === 'failed' ? [action.id] : [],
    )
    await retryFailedActions(ids)
    setMessage(`已将 ${ids.length} 个明确失败的操作重新放回等待队列。`)
    await loadPlan()
  }

  async function queueRestore(entry: ActionPlanEntry) {
    await queueGitHubActions(
      [entry.action.repositoryId],
      'star',
      '用户请求恢复此前取消的 Star',
    )
    setMessage('已创建重新 Star 的恢复操作。收藏时间可能发生变化。')
    await loadPlan()
  }

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-16">
      <Link
        to="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> 返回 Dashboard
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div>
          <div className="eyebrow mb-4">
            ACTION CENTER · EXPLICIT WRITE MODE
          </div>
          <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
            先看完整计划，再修改 GitHub
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            本地“放弃”不会自动取消 Star。只有当前页面开启 Action
            Mode、输入确认词并点击执行后，才会发出写请求。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <ActionMetric
              label="等待执行"
              value={counts.queued}
              icon={History}
            />
            <ActionMetric
              label="执行成功"
              value={counts.succeeded}
              icon={CheckCircle2}
            />
            <ActionMetric
              label="需要检查"
              value={counts.failed + counts.cancelled}
              icon={AlertTriangle}
            />
          </div>

          {message && (
            <div
              className="mt-5 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-bold text-ink"
              role="status"
            >
              {message}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-ink bg-white/75">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper p-4">
              <span className="text-sm font-black text-ink">
                已选择 {selectedQueued.length} 个等待操作
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!counts.queued || executing}
                  onClick={() =>
                    setSelected(
                      new Set(
                        entries.flatMap(({ action }) =>
                          action.status === 'queued' && action.id !== undefined
                            ? [action.id]
                            : [],
                        ),
                      ),
                    )
                  }
                >
                  <CheckCircle2 size={15} /> 选择全部等待项
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!selectedQueued.length || executing}
                  onClick={() => void removeSelected()}
                >
                  <Trash2 size={15} /> 移出计划
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!counts.failed}
                  onClick={() => void retryFailures()}
                >
                  <RefreshCcw size={15} /> 重试明确失败项
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-72 place-items-center">
                <LoaderCircle size={28} className="animate-spin text-signal" />
              </div>
            ) : entries.length ? (
              <>
                <div className="divide-y divide-line">
                  {visibleEntries.map((entry) => {
                    const { action, repository } = entry
                    const canSelect =
                      action.status === 'queued' && action.id !== undefined
                    return (
                      <article key={action.id} className="action-plan-row">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            canSelect && selected.has(action.id!),
                          )}
                          disabled={!canSelect}
                          onChange={() =>
                            action.id !== undefined && toggleAction(action.id)
                          }
                          aria-label={`选择 ${action.repositoryFullNameAtQueue} 的操作`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="break-all text-sm text-ink">
                              {repository?.fullName ??
                                action.repositoryFullNameAtQueue}
                            </strong>
                            <span
                              className={`action-status action-status-${action.status}`}
                            >
                              {statusLabels[action.status]}
                            </span>
                            <span className="library-mini-tag">
                              {action.action === 'unstar'
                                ? '取消 Star'
                                : '重新 Star'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted">
                            {action.reason}
                          </p>
                          {action.failureCode && (
                            <p className="mt-2 text-xs font-bold text-red-700">
                              {failureText(action.failureCode)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {repository && (
                            <a
                              href={repository.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="icon-button"
                              aria-label={`在 GitHub 核对 ${repository.fullName}`}
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                          {action.status === 'succeeded' &&
                            action.action === 'unstar' && (
                              <button
                                type="button"
                                className="button-secondary"
                                onClick={() => void queueRestore(entry)}
                              >
                                <Star size={14} /> 创建恢复计划
                              </button>
                            )}
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-line bg-paper p-4 text-xs font-bold text-muted">
                  <span>
                    第 {safePage} / {totalPages} 页 · 共 {entries.length} 条记录
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="library-page-button"
                      disabled={safePage <= 1}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      className="library-page-button"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <CircleOff size={30} className="mx-auto text-muted" />
                  <h2 className="mt-4 text-xl font-black text-ink">
                    还没有远程操作
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    先去 Smart Triage 确认清理候选。
                  </p>
                  <Link to="/triage" className="button-primary mt-5">
                    打开 Smart Triage
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="action-mode-panel lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-ink">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="panel-kicker">WRITE SAFETY</p>
              <h2 className="mt-1 text-xl font-black text-ink">Action Mode</h2>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            <strong className="flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> 写操作不可完全无损撤销
            </strong>
            <p className="mt-2">
              重新 Star 可能改变原收藏时间。中途取消网络请求时，必须到 GitHub
              核对最终状态。
            </p>
          </div>

          <label className="review-field mt-6">
            <span className="inline-flex items-center gap-2">
              <KeyRound size={14} /> Fine-grained Token
            </span>
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder={
                sessionToken
                  ? '当前页面已有内存 Token'
                  : '需要 Starring: Read and write'
              }
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
            />
          </label>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Token 只存在当前页面内存，不进入 IndexedDB、URL、日志或导出文件。
            私有仓库还需包含在 Token 的仓库访问范围内。
          </p>
          <a
            href={GITHUB_WRITE_TOKEN_TEMPLATE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-signal hover:underline"
          >
            一键打开最小写权限 Token 页面 <ExternalLink size={13} />
          </a>

          <label className="mt-5 flex items-start gap-3 text-xs font-bold leading-5 text-ink">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-signal"
              checked={actionMode}
              onChange={(event) => setActionMode(event.target.checked)}
            />
            我已经检查当前选择，并主动开启 GitHub 写入模式。
          </label>

          <label className="review-field mt-5">
            <span>输入 EXECUTE 确认</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="EXECUTE"
              autoComplete="off"
            />
          </label>

          {executing && (
            <div
              className="mt-5 rounded-xl border border-line bg-paper p-4"
              aria-live="polite"
            >
              <div className="flex items-center justify-between text-xs font-black text-ink">
                <span>{progress.currentRepository || '正在完成操作'}</span>
                <span>
                  {progress.completed} / {progress.total}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full bg-signal transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="button-primary mt-6 w-full justify-center"
            disabled={!ready}
            onClick={() => void executeSelected()}
          >
            {executing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Play size={17} />
            )}
            执行 {selectedQueued.length} 个 GitHub 操作
          </button>
          {executing && (
            <button
              type="button"
              className="button-secondary mt-2 w-full justify-center"
              onClick={() => abortController.current?.abort()}
            >
              <XCircle size={16} /> 停止后续操作
            </button>
          )}

          <div className="mt-6 border-t border-line pt-5 text-xs leading-5 text-muted">
            <p className="flex items-start gap-2">
              <GitPullRequestArrow size={15} className="mt-0.5 shrink-0" />
              GitHub Lists 暂无稳定公开 API，因此 Action Center 只执行官方
              Star/Unstar 接口。
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function ActionMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof History
}) {
  return (
    <div className="rounded-xl border border-line bg-paper/75 p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-black">{label}</span>
        <Icon size={16} />
      </div>
      <p className="mt-4 font-serif text-4xl text-ink">{value}</p>
    </div>
  )
}
