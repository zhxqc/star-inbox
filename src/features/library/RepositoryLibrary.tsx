import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  ChevronFirst,
  ChevronLast,
  ExternalLink,
  FileSearch,
  GitFork,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Save,
  Star,
  Tags,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  RepositoryIntent,
  RepositoryLifecycleStatus,
} from '../../domain/repository'
import { githubClient, GitHubApiError } from '../../github/client'
import { useTokenSession } from '../../security/token-session'
import {
  bulkUpdateRepositoryMetadata,
  getRepositoryLibraryPage,
  type RepositoryLibraryEntry,
  type RepositoryLibraryPage,
  saveRepositoryMetadata,
} from './library-store'

const intentOptions: Array<{ value: RepositoryIntent; label: string }> = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'try', label: '准备试用' },
  { value: 'reference', label: '参考资料' },
  { value: 'using', label: '正在使用' },
  { value: 'content', label: '内容素材' },
  { value: 'support', label: '仅关注或支持' },
  { value: 'uncertain', label: '暂不确定' },
]

const lifecycleOptions: Array<{
  value: RepositoryLifecycleStatus
  label: string
}> = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'reviewed', label: '已回顾' },
  { value: 'to-verify', label: '准备验证' },
  { value: 'verified', label: '已验证' },
  { value: 'dropped', label: '已放弃' },
  { value: 'archived', label: '已归档' },
]

const pageSizeOptions = [20, 50, 100]

function intentLabel(value?: RepositoryIntent) {
  return intentOptions.find((option) => option.value === (value ?? 'inbox'))!
    .label
}

function lifecycleLabel(value?: RepositoryLifecycleStatus) {
  return lifecycleOptions.find((option) => option.value === (value ?? 'inbox'))!
    .label
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function splitTags(value: string) {
  return value.split(/[,，\n]/)
}

export function RepositoryLibrary({
  onMetadataChange,
}: {
  onMetadataChange?: () => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<RepositoryLibraryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadVersion, setReloadVersion] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkIntent, setBulkIntent] = useState<RepositoryIntent | ''>('')
  const [bulkLifecycle, setBulkLifecycle] = useState<
    RepositoryLifecycleStatus | ''
  >('')
  const [bulkTags, setBulkTags] = useState('')
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [message, setMessage] = useState('')
  const [detailEntry, setDetailEntry] = useState<RepositoryLibraryEntry | null>(
    null,
  )

  useEffect(() => {
    let mounted = true
    void getRepositoryLibraryPage(page, pageSize)
      .then((nextData) => {
        if (!mounted) return
        setData(nextData)
        setSelectedIds(new Set())
        if (nextData.page !== page) setPage(nextData.page)
      })
      .catch(() => {
        if (mounted) setMessage('无法读取本地 Stars 列表，请刷新后重试。')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [page, pageSize, reloadVersion])

  function moveToPage(nextPage: number) {
    setLoading(true)
    setPage(nextPage)
  }

  const allCurrentPageSelected = Boolean(
    data?.items.length &&
    data.items.every(({ repository }) => selectedIds.has(repository.githubId)),
  )
  const hasBulkChange = Boolean(bulkIntent || bulkLifecycle || bulkTags.trim())

  function toggleRepository(repositoryId: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(repositoryId)) next.delete(repositoryId)
      else next.add(repositoryId)
      return next
    })
  }

  function toggleCurrentPage() {
    if (!data) return
    setSelectedIds(
      allCurrentPageSelected
        ? new Set()
        : new Set(data.items.map(({ repository }) => repository.githubId)),
    )
  }

  async function applyBulkUpdate() {
    if (!selectedIds.size || !hasBulkChange || applyingBulk) return
    setApplyingBulk(true)
    setMessage('')
    try {
      await bulkUpdateRepositoryMetadata([...selectedIds], {
        intent: bulkIntent || undefined,
        lifecycleStatus: bulkLifecycle || undefined,
        addTags: splitTags(bulkTags),
      })
      setMessage(`已更新 ${selectedIds.size.toLocaleString()} 个项目。`)
      setSelectedIds(new Set())
      setBulkIntent('')
      setBulkLifecycle('')
      setBulkTags('')
      setLoading(true)
      setReloadVersion((current) => current + 1)
      onMetadataChange?.()
    } catch {
      setMessage('批量更新失败，本地数据没有被部分覆盖，请重试。')
    } finally {
      setApplyingBulk(false)
    }
  }

  function handleDetailSaved(entry: RepositoryLibraryEntry) {
    setDetailEntry(entry)
    setData((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((item) =>
              item.repository.githubId === entry.repository.githubId
                ? entry
                : item,
            ),
          }
        : previous,
    )
    onMetadataChange?.()
  }

  return (
    <section className="mt-12" aria-labelledby="repository-library-title">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow mb-3">YOUR COMPLETE LOCAL LIBRARY</div>
          <h2
            id="repository-library-title"
            className="text-3xl font-black tracking-[-0.04em] text-ink"
          >
            全部 Stars
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            默认按收藏时间倒序。列表只读取
            IndexedDB，每页最多渲染当前选择的数量。
          </p>
        </div>
        <button
          type="button"
          className="button-secondary self-start sm:self-auto"
          onClick={() => {
            setLoading(true)
            setReloadVersion((current) => current + 1)
          }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          刷新列表
        </button>
      </div>

      <div className="library-card mt-6">
        <div className="library-bulk-toolbar">
          <div className="flex min-w-32 items-center gap-2 text-sm font-black text-ink">
            <Check size={16} /> 已选择 {selectedIds.size.toLocaleString()}
          </div>
          <label className="library-toolbar-field">
            <span>收藏意图</span>
            <select
              value={bulkIntent}
              onChange={(event) =>
                setBulkIntent(event.target.value as RepositoryIntent | '')
              }
            >
              <option value="">不修改</option>
              {intentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="library-toolbar-field">
            <span>生命周期</span>
            <select
              value={bulkLifecycle}
              onChange={(event) =>
                setBulkLifecycle(
                  event.target.value as RepositoryLifecycleStatus | '',
                )
              }
            >
              <option value="">不修改</option>
              {lifecycleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="library-toolbar-field min-w-48 flex-1">
            <span>追加标签</span>
            <input
              value={bulkTags}
              onChange={(event) => setBulkTags(event.target.value)}
              placeholder="AI, CLI, Local-first"
            />
          </label>
          <button
            type="button"
            className="button-primary shrink-0"
            onClick={() => void applyBulkUpdate()}
            disabled={!selectedIds.size || !hasBulkChange || applyingBulk}
          >
            {applyingBulk ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            应用到所选
          </button>
        </div>

        {message && (
          <div className="border-b border-line bg-accent/30 px-4 py-2.5 text-xs font-bold text-ink">
            {message}
          </div>
        )}

        <div className="library-table-scroll">
          <table className="library-table">
            <thead>
              <tr>
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPage}
                    aria-label="选择当前页全部项目"
                  />
                </th>
                <th>仓库</th>
                <th>收藏意图</th>
                <th>生命周期</th>
                <th>语言</th>
                <th>收藏时间</th>
                <th>最近推送</th>
                <th className="text-right">Stars</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted">
                    <LoaderCircle
                      size={22}
                      className="mx-auto animate-spin text-signal"
                    />
                    <span className="mt-3 block text-sm">
                      正在读取本地 Stars…
                    </span>
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((entry) => {
                  const { repository, metadata } = entry
                  return (
                    <tr key={repository.githubId}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(repository.githubId)}
                          onChange={() => toggleRepository(repository.githubId)}
                          aria-label={`选择 ${repository.fullName}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="library-repository-name"
                          onClick={() => setDetailEntry(entry)}
                        >
                          {repository.fullName}
                        </button>
                        <span className="library-repository-description">
                          {repository.description || '没有 Description'}
                        </span>
                        {metadata?.tags.length ? (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {metadata.tags.slice(0, 3).map((tag) => (
                              <small key={tag} className="library-mini-tag">
                                {tag}
                              </small>
                            ))}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="library-status-pill">
                          {intentLabel(metadata?.intent)}
                        </span>
                      </td>
                      <td>
                        <span className="library-status-pill library-status-muted">
                          {lifecycleLabel(metadata?.lifecycleStatus)}
                        </span>
                      </td>
                      <td>{repository.primaryLanguage || '—'}</td>
                      <td>{formatDate(repository.starredAt)}</td>
                      <td>{formatDate(repository.pushedAt)}</td>
                      <td className="text-right font-mono font-bold">
                        {repository.stargazersCount.toLocaleString()}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="library-detail-button"
                          onClick={() => setDetailEntry(entry)}
                        >
                          详情 <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted">
                    当前浏览器还没有 Stars 数据。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="library-pagination">
          <div className="text-xs font-bold text-muted">
            共 {(data?.total ?? 0).toLocaleString()} 条 · 第{' '}
            {data?.page ?? page} / {data?.totalPages ?? 1} 页
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-muted">
              每页
              <select
                className="library-page-size"
                value={pageSize}
                onChange={(event) => {
                  setLoading(true)
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} 条
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="library-page-button"
              onClick={() => moveToPage(1)}
              disabled={(data?.page ?? page) <= 1 || loading}
              aria-label="第一页"
            >
              <ChevronFirst size={16} />
            </button>
            <button
              type="button"
              className="library-page-button"
              onClick={() => moveToPage(Math.max(1, page - 1))}
              disabled={(data?.page ?? page) <= 1 || loading}
            >
              <ArrowLeft size={15} /> 上一页
            </button>
            <button
              type="button"
              className="library-page-button"
              onClick={() =>
                moveToPage(Math.min(data?.totalPages ?? page, page + 1))
              }
              disabled={
                (data?.page ?? page) >= (data?.totalPages ?? 1) || loading
              }
            >
              下一页 <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="library-page-button"
              onClick={() => moveToPage(data?.totalPages ?? 1)}
              disabled={
                (data?.page ?? page) >= (data?.totalPages ?? 1) || loading
              }
              aria-label="最后一页"
            >
              <ChevronLast size={16} />
            </button>
          </div>
        </div>
      </div>

      {detailEntry && (
        <RepositoryDetailDialog
          key={detailEntry.repository.githubId}
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onSaved={handleDetailSaved}
        />
      )}
    </section>
  )
}

function RepositoryDetailDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: RepositoryLibraryEntry
  onClose: () => void
  onSaved: (entry: RepositoryLibraryEntry) => void
}) {
  const { repository, metadata } = entry
  const { token: sessionToken, setToken } = useTokenSession()
  const [intent, setIntent] = useState<RepositoryIntent>(
    metadata?.intent ?? 'inbox',
  )
  const [lifecycleStatus, setLifecycleStatus] =
    useState<RepositoryLifecycleStatus>(metadata?.lifecycleStatus ?? 'inbox')
  const [customSummary, setCustomSummary] = useState(
    metadata?.customSummary ?? '',
  )
  const [whyStarred, setWhyStarred] = useState(metadata?.whyStarred ?? '')
  const [tags, setTags] = useState(metadata?.tags.join(', ') ?? '')
  const [note, setNote] = useState(metadata?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [readme, setReadme] = useState('')
  const [readmeTruncated, setReadmeTruncated] = useState(false)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [readmeError, setReadmeError] = useState('')
  const dialogContentRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = 0
      dialogContentRef.current.scrollLeft = 0
    }
    closeButtonRef.current?.focus({ preventScroll: true })

    return () => previouslyFocused?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setSaveMessage('')
    try {
      const savedMetadata = await saveRepositoryMetadata({
        repositoryId: repository.githubId,
        intent,
        lifecycleStatus,
        customSummary,
        whyStarred,
        tags: splitTags(tags),
        note,
      })
      onSaved({ repository, metadata: savedMetadata })
      setSaveMessage('本地整理结果已保存。')
    } catch {
      setSaveMessage('保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  async function loadReadme() {
    if (readmeLoading) return
    const candidate = (sessionToken ?? tokenInput.trim()) || undefined
    if (repository.private && !candidate) {
      setReadmeError('私有仓库需要具有 Contents 读取权限的 Token。')
      return
    }

    setReadmeLoading(true)
    setReadmeError('')
    try {
      const result = await githubClient.getRepositoryReadme(
        repository.fullName,
        candidate,
      )
      setReadme(result.content)
      setReadmeTruncated(result.truncated)
      if (!sessionToken && candidate) {
        setToken(candidate)
        setTokenInput('')
      }
    } catch (error) {
      setReadmeError(
        error instanceof GitHubApiError
          ? error.message
          : 'README 加载失败，请重试。',
      )
    } finally {
      setReadmeLoading(false)
    }
  }

  return createPortal(
    <div
      className="repository-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="repository-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repository-detail-title"
      >
        <header className="repository-dialog-header">
          <div className="min-w-0">
            <p className="panel-kicker">REPOSITORY DETAIL</p>
            <h2
              id="repository-detail-title"
              className="mt-1 truncate text-2xl font-black tracking-tight text-ink"
            >
              {repository.fullName}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button shrink-0"
            onClick={onClose}
            aria-label="关闭详情"
          >
            <X size={19} />
          </button>
        </header>

        <div ref={dialogContentRef} className="repository-dialog-content">
          <div className="repository-detail-hero">
            <p>{repository.description || '这个仓库没有 Description。'}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Star size={14} /> {repository.stargazersCount.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitFork size={14} /> {repository.forksCount.toLocaleString()}
              </span>
              <span>{repository.primaryLanguage || '未知语言'}</span>
              <span>{repository.licenseSpdx || '未知 License'}</span>
              <span>收藏于 {formatDate(repository.starredAt)}</span>
            </div>
            <a
              href={repository.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="button-secondary mt-5"
            >
              打开 GitHub <ExternalLink size={15} />
            </a>
          </div>

          <div className="repository-detail-grid">
            <label className="review-field">
              <span>收藏意图</span>
              <select
                value={intent}
                onChange={(event) =>
                  setIntent(event.target.value as RepositoryIntent)
                }
              >
                {intentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="review-field">
              <span>生命周期</span>
              <select
                value={lifecycleStatus}
                onChange={(event) =>
                  setLifecycleStatus(
                    event.target.value as RepositoryLifecycleStatus,
                  )
                }
              >
                {lifecycleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-5">
            <label className="review-field">
              <span>一句话用途</span>
              <input
                value={customSummary}
                onChange={(event) => setCustomSummary(event.target.value)}
                placeholder="用自己的语言说明它解决什么问题"
              />
            </label>
            <label className="review-field">
              <span>为什么收藏</span>
              <textarea
                value={whyStarred}
                onChange={(event) => setWhyStarred(event.target.value)}
                rows={3}
                placeholder="当时准备解决什么问题？"
              />
            </label>
            <label className="review-field">
              <span className="inline-flex items-center gap-2">
                <Tags size={14} /> 标签
              </span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="AI, CLI, Local-first"
              />
            </label>
            <label className="review-field">
              <span>私人备注</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="你的验证过程和结论"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-7">
            <span className="text-xs font-bold text-muted">{saveMessage}</span>
            <button
              type="button"
              className="button-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              保存单项设置
            </button>
          </div>

          <section className="mt-7" aria-labelledby="readme-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="panel-kicker">ON-DEMAND ENRICHMENT</p>
                <h3
                  id="readme-heading"
                  className="mt-1 flex items-center gap-2 text-xl font-black text-ink"
                >
                  <BookOpenText size={19} /> README
                </h3>
                <p className="mt-2 max-w-xl text-xs leading-5 text-muted">
                  只在打开详情后按需读取，不批量抓取、不写入
                  IndexedDB。公开仓库无需 Token；私有仓库需要 Contents
                  读取权限。
                </p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => void loadReadme()}
                disabled={readmeLoading}
              >
                {readmeLoading ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <FileSearch size={16} />
                )}
                {readme ? '重新加载' : '加载 README'}
              </button>
            </div>

            {!sessionToken && (
              <label className="review-field mt-4">
                <span className="inline-flex items-center gap-2">
                  <LockKeyhole size={14} /> 可选 Token（仅当前页面内存）
                </span>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="私有仓库或更高 API 限额时使用"
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </label>
            )}

            {readmeError && (
              <div className="error-banner mt-4" role="alert">
                {readmeError}
              </div>
            )}
            {readme && (
              <div className="readme-preview mt-5">
                <pre>{readme}</pre>
                {readmeTruncated && (
                  <p>README 内容较长，本地预览只显示前 120,000 个字符。</p>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>,
    document.body,
  )
}
