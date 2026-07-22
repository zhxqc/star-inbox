import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  FlaskConical,
  Heart,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Star,
  Tags,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRepositoryMetadata } from '../domain/repository'
import {
  getReviewWorkspace,
  type ReviewIntent,
  type ReviewQueueEntry,
  type ReviewWorkspace,
  saveRepositoryReview,
} from '../features/review/review-queue'

const intents: Array<{
  value: ReviewIntent
  label: string
  description: string
  icon: typeof FlaskConical
}> = [
  {
    value: 'try',
    label: '准备试用',
    description: '进入待验证清单',
    icon: FlaskConical,
  },
  {
    value: 'reference',
    label: '参考资料',
    description: '以后需要时查阅',
    icon: BookOpen,
  },
  {
    value: 'using',
    label: '正在使用',
    description: '已经进入真实工作流',
    icon: Wrench,
  },
  {
    value: 'content',
    label: '内容素材',
    description: '文章、视频或研究素材',
    icon: FileText,
  },
  {
    value: 'support',
    label: '仅关注或支持',
    description: '不需要进一步处理',
    icon: Heart,
  },
  {
    value: 'uncertain',
    label: '暂不确定',
    description: '保留到下一次判断',
    icon: CircleHelp,
  },
]

function formatDate(value?: string) {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function reviewEntryWithMetadata(
  entry: ReviewQueueEntry,
  metadata: UserRepositoryMetadata,
) {
  return { ...entry, metadata }
}

interface ReviewDraft {
  intent: ReviewIntent | null
  customSummary: string
  whyStarred: string
  note: string
  tags: string
}

function createReviewDraft(entry?: ReviewQueueEntry): ReviewDraft {
  const metadata = entry?.metadata
  return {
    intent: metadata && metadata.intent !== 'inbox' ? metadata.intent : null,
    customSummary: metadata?.customSummary ?? '',
    whyStarred: metadata?.whyStarred ?? '',
    note: metadata?.note ?? '',
    tags: metadata?.tags.join(', ') ?? '',
  }
}

export function ReviewPage() {
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') === 'reviewed' ? 'reviewed' : 'pending'
  const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null)
  const [drafts, setDrafts] = useState<Record<number, ReviewDraft>>({})
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true
    void getReviewWorkspace()
      .then((nextWorkspace) => {
        if (mounted) setWorkspace(nextWorkspace)
      })
      .catch(() => {
        if (mounted) setErrorMessage('无法读取浏览器中的回顾队列。')
      })
    return () => {
      mounted = false
    }
  }, [])

  const entries = workspace?.[view] ?? []
  const current = entries[0]
  const currentDraft = current
    ? (drafts[current.repository.githubId] ?? createReviewDraft(current))
    : createReviewDraft()

  function updateCurrentDraft(update: Partial<ReviewDraft>) {
    if (!current) return
    setDrafts((previous) => ({
      ...previous,
      [current.repository.githubId]: { ...currentDraft, ...update },
    }))
  }

  function moveCurrentToBack() {
    if (!workspace || entries.length < 2) return
    setWorkspace({
      ...workspace,
      [view]: [...entries.slice(1), entries[0]],
    })
  }

  async function handleSave() {
    if (!workspace || !current || !currentDraft.intent || saving) return
    setSaving(true)
    setErrorMessage('')

    try {
      const metadata = await saveRepositoryReview({
        repositoryId: current.repository.githubId,
        intent: currentDraft.intent,
        customSummary: currentDraft.customSummary,
        whyStarred: currentDraft.whyStarred,
        note: currentDraft.note,
        tags: currentDraft.tags.split(/[,，\n]/),
      })
      const savedEntry = reviewEntryWithMetadata(current, metadata)

      setWorkspace((previous) => {
        if (!previous) return previous
        if (view === 'pending') {
          return {
            ...previous,
            pending: previous.pending.filter(
              ({ repository }) =>
                repository.githubId !== current.repository.githubId,
            ),
            reviewed: [
              savedEntry,
              ...previous.reviewed.filter(
                ({ repository }) =>
                  repository.githubId !== current.repository.githubId,
              ),
            ],
          }
        }

        return {
          ...previous,
          reviewed: [
            ...previous.reviewed.filter(
              ({ repository }) =>
                repository.githubId !== current.repository.githubId,
            ),
            savedEntry,
          ],
        }
      })
    } catch {
      setErrorMessage('保存失败，本地数据没有被修改，请重试。')
    } finally {
      setSaving(false)
    }
  }

  if (!workspace) {
    return <ReviewSkeleton />
  }

  const reviewedCount = workspace.reviewed.length
  const progress = workspace.total
    ? Math.round((reviewedCount / workspace.total) * 100)
    : 0

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
          <div className="eyebrow mb-4">REVIEW · ONE DECISION AT A TIME</div>
          <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
            Review Queue
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            每次只处理一个项目。先回答为什么收藏，再决定它是否值得继续占用注意力。
          </p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-line bg-white/70 p-4">
          <div className="flex items-center justify-between text-xs font-extrabold text-ink">
            <span>回顾进度</span>
            <span className="font-mono">
              {reviewedCount.toLocaleString()} /{' '}
              {workspace.total.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-signal transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-right font-mono text-[10px] font-bold text-muted">
            {progress}% · 剩余 {workspace.pending.length.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2" aria-label="回顾视图">
        <Link
          to="/review"
          className={`review-view-tab ${view === 'pending' ? 'review-view-tab-active' : ''}`}
        >
          <Inbox size={16} /> 待回顾 {workspace.pending.length.toLocaleString()}
        </Link>
        <Link
          to="/review?view=reviewed"
          className={`review-view-tab ${view === 'reviewed' ? 'review-view-tab-active' : ''}`}
        >
          <CheckCircle2 size={16} /> 已回顾 {reviewedCount.toLocaleString()}
        </Link>
      </div>

      {errorMessage && (
        <div className="error-banner mt-6" role="alert">
          <MessageSquareText size={17} /> {errorMessage}
        </div>
      )}

      {!current ? (
        <EmptyReviewState
          total={workspace.total}
          view={view}
          reviewedCount={reviewedCount}
        />
      ) : (
        <div
          key={`${view}-${current.repository.githubId}`}
          className="review-workspace mt-6"
        >
          <article className="review-repository-panel">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-black text-ink uppercase">
                    {view === 'pending' ? 'Inbox' : 'Reviewed'}
                  </span>
                  {current.repository.archived && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] font-bold text-muted">
                      <Archive size={12} /> 已归档
                    </span>
                  )}
                </div>
                <h2 className="mt-5 break-words text-3xl font-black tracking-[-0.04em] text-ink">
                  {current.repository.fullName}
                </h2>
              </div>
              <a
                href={current.repository.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="button-secondary shrink-0"
              >
                打开 GitHub <ExternalLink size={15} />
              </a>
            </div>

            <p className="mt-6 text-base leading-7 text-muted">
              {current.repository.description || '这个仓库没有 Description。'}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Fact label="主语言" value={current.repository.primaryLanguage} />
              <Fact label="License" value={current.repository.licenseSpdx} />
              <Fact
                label="GitHub Stars"
                value={current.repository.stargazersCount.toLocaleString()}
              />
              <Fact
                label="收藏时间"
                value={formatDate(current.repository.starredAt)}
              />
              <Fact
                label="最近推送"
                value={formatDate(current.repository.pushedAt)}
              />
              <Fact
                label="项目类型"
                value={
                  current.repository.isTemplate
                    ? 'Template'
                    : current.repository.fork
                      ? 'Fork'
                      : 'Repository'
                }
              />
            </div>

            <div className="mt-7">
              <p className="panel-kicker">GITHUB TOPICS</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {current.repository.topics.length ? (
                  current.repository.topics.map((topic) => (
                    <span key={topic} className="topic-chip">
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">没有 Topics</span>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6 text-xs leading-6 text-muted">
              GitHub
              元数据只用于提供上下文。右侧所有选择、标签和笔记都属于你的本地数据，后续导入不会覆盖。
            </div>
          </article>

          <article className="review-form-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="panel-kicker">YOUR DECISION</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
                  我为什么保存它？
                </h2>
              </div>
              {current.metadata?.lastReviewedAt && (
                <span className="text-right text-[10px] leading-4 font-bold text-muted">
                  上次回顾
                  <br />
                  {formatDate(current.metadata.lastReviewedAt)}
                </span>
              )}
            </div>

            <div className="review-intent-grid mt-6">
              {intents.map((option) => {
                const Icon = option.icon
                const active = currentDraft.intent === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`review-intent-option ${active ? 'review-intent-option-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => updateCurrentDraft({ intent: option.value })}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    {active && <Check size={16} className="ml-auto" />}
                  </button>
                )
              })}
            </div>

            <div className="mt-7 space-y-5">
              <label className="review-field">
                <span>一句话用途</span>
                <input
                  value={currentDraft.customSummary}
                  onChange={(event) =>
                    updateCurrentDraft({ customSummary: event.target.value })
                  }
                  placeholder="例如：本地运行的开源 AI 编程 Agent"
                  maxLength={180}
                />
              </label>

              <label className="review-field">
                <span>为什么收藏</span>
                <textarea
                  value={currentDraft.whyStarred}
                  onChange={(event) =>
                    updateCurrentDraft({ whyStarred: event.target.value })
                  }
                  placeholder="当时想解决什么问题？准备和什么方案比较？"
                  rows={3}
                />
              </label>

              <label className="review-field">
                <span className="inline-flex items-center gap-2">
                  <Tags size={14} /> 标签
                </span>
                <input
                  value={currentDraft.tags}
                  onChange={(event) =>
                    updateCurrentDraft({ tags: event.target.value })
                  }
                  placeholder="AI, Local-first, CLI（逗号分隔）"
                />
              </label>

              <label className="review-field">
                <span>私人备注</span>
                <textarea
                  value={currentDraft.note}
                  onChange={(event) =>
                    updateCurrentDraft({ note: event.target.value })
                  }
                  placeholder="只保存在当前浏览器，不会上传到 GitHub。"
                  rows={4}
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="button-secondary"
                onClick={moveCurrentToBack}
                disabled={entries.length < 2 || saving}
              >
                <RotateCcw size={15} /> 跳过这个
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => void handleSave()}
                disabled={!currentDraft.intent || saving}
              >
                {saving ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> 保存中
                  </>
                ) : (
                  <>
                    {view === 'pending' ? '保存并下一个' : '更新并下一个'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/80 p-3">
      <span className="block font-mono text-[9px] font-black tracking-wider text-muted uppercase">
        {label}
      </span>
      <strong className="mt-1.5 block truncate text-sm text-ink">
        {value || '未知'}
      </strong>
    </div>
  )
}

function EmptyReviewState({
  total,
  view,
  reviewedCount,
}: {
  total: number
  view: 'pending' | 'reviewed'
  reviewedCount: number
}) {
  if (total === 0) {
    return (
      <div className="review-empty-state">
        <Inbox size={30} />
        <h2>还没有可以回顾的 Stars</h2>
        <p>先完成一次 GitHub Stars 导入，回顾队列会自动在本地生成。</p>
        <Link to="/import" className="button-primary mt-6">
          前往导入 <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  if (view === 'pending') {
    return (
      <div className="review-empty-state">
        <CheckCircle2 size={32} />
        <h2>Inbox 清空了</h2>
        <p>
          你已经回顾了 {reviewedCount.toLocaleString()}{' '}
          个项目。所有判断都已保存在当前浏览器。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/review?view=reviewed" className="button-primary">
            查看已回顾 <ArrowRight size={16} />
          </Link>
          <Link to="/dashboard" className="button-secondary">
            返回 Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="review-empty-state">
      <Star size={30} />
      <h2>还没有已回顾项目</h2>
      <p>从待回顾队列保存第一个判断后，它会出现在这里供你继续查看和修改。</p>
      <Link to="/review" className="button-primary mt-6">
        开始第一次回顾 <ArrowRight size={16} />
      </Link>
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <section
      className="page-shell py-10 sm:py-14 lg:py-16"
      aria-label="正在读取回顾队列"
      aria-busy="true"
    >
      <div className="skeleton-block h-3 w-48 rounded-full" />
      <div className="skeleton-block mt-5 h-12 w-72 max-w-full rounded-xl" />
      <div className="skeleton-block mt-4 h-4 w-96 max-w-full rounded-full" />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="skeleton-card h-[34rem]" />
        <div className="skeleton-card h-[34rem]" />
      </div>
      <span className="sr-only">正在读取浏览器中的回顾数据…</span>
    </section>
  )
}
