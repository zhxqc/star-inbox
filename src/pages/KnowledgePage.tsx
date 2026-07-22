import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  LoaderCircle,
  Save,
  ShieldAlert,
  Tags,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { KnowledgeExportEntry } from '../features/export/knowledge-export'
import {
  buildKnowledgeCollection,
  buildRepositoryMarkdown,
  downloadTextFile,
  safeMarkdownFilename,
} from '../features/export/knowledge-export'
import {
  getKnowledgeWorkspace,
  saveVerification,
  type KnowledgeWorkspace,
} from '../features/export/knowledge-store'

interface VerificationDraft {
  customSummary: string
  whyStarred: string
  useCases: string
  alternatives: string
  verificationSummary: string
  tags: string
}

function createDraft(entry?: KnowledgeExportEntry): VerificationDraft {
  return {
    customSummary: entry?.metadata.customSummary ?? '',
    whyStarred: entry?.metadata.whyStarred ?? '',
    useCases: entry?.metadata.useCases ?? '',
    alternatives: entry?.metadata.alternatives ?? '',
    verificationSummary:
      entry?.metadata.verificationSummary ?? entry?.metadata.note ?? '',
    tags: entry?.metadata.tags.join(', ') ?? '',
  }
}

export function KnowledgePage() {
  const [workspace, setWorkspace] = useState<KnowledgeWorkspace | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draft, setDraft] = useState<VerificationDraft>(createDraft())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [includePrivate, setIncludePrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function loadWorkspace(preferredId?: number) {
    const next = await getKnowledgeWorkspace()
    setWorkspace(next)
    const all = [...next.toVerify, ...next.verified]
    const nextActive =
      all.find((entry) => entry.repository.githubId === preferredId) ?? all[0]
    setActiveId(nextActive?.repository.githubId ?? null)
    setDraft(createDraft(nextActive))
    setSelected(
      new Set(next.verified.map((entry) => entry.repository.githubId)),
    )
  }

  useEffect(() => {
    let mounted = true
    void getKnowledgeWorkspace()
      .then((next) => {
        if (!mounted) return
        setWorkspace(next)
        const all = [...next.toVerify, ...next.verified]
        const nextActive = all[0]
        setActiveId(nextActive?.repository.githubId ?? null)
        setDraft(createDraft(nextActive))
        setSelected(
          new Set(next.verified.map((entry) => entry.repository.githubId)),
        )
      })
      .catch(() => {
        if (mounted) setMessage('无法读取待验证项目。')
      })
    return () => {
      mounted = false
    }
  }, [])

  const entries = useMemo(
    () => [...(workspace?.toVerify ?? []), ...(workspace?.verified ?? [])],
    [workspace],
  )
  const activeEntry = entries.find(
    (entry) => entry.repository.githubId === activeId,
  )
  const exportEntries = (workspace?.verified ?? []).filter(
    (entry) =>
      selected.has(entry.repository.githubId) &&
      (includePrivate || !entry.repository.private),
  )

  function activate(entry: KnowledgeExportEntry) {
    setActiveId(entry.repository.githubId)
    setDraft(createDraft(entry))
    setMessage('')
  }

  async function handleSave() {
    if (!activeEntry || !draft.verificationSummary.trim() || saving) return
    setSaving(true)
    setMessage('')
    try {
      await saveVerification({
        repositoryId: activeEntry.repository.githubId,
        ...draft,
        tags: draft.tags.split(/[,，\n]/),
      })
      setMessage('验证结论已保存在当前浏览器。')
      await loadWorkspace(activeEntry.repository.githubId)
    } catch {
      setMessage('验证结果保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  function exportSingle() {
    if (!activeEntry || activeEntry.metadata.lifecycleStatus !== 'verified')
      return
    downloadTextFile(
      safeMarkdownFilename(activeEntry),
      buildRepositoryMarkdown(activeEntry),
    )
    setMessage(`已生成 ${safeMarkdownFilename(activeEntry)}。`)
  }

  function exportCollection() {
    if (!exportEntries.length) return
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `star-inbox-verified-${date}.md`,
      buildKnowledgeCollection(exportEntries),
    )
    setMessage(`已导出 ${exportEntries.length} 个已验证项目。`)
  }

  return (
    <section className="page-shell py-10 sm:py-14 lg:py-16">
      <Link
        to="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> 返回 Dashboard
      </Link>
      <div className="eyebrow mb-4">VERIFY → KNOWLEDGE</div>
      <h1 className="text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
        只整理真正准备使用的项目
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">
        普通 Star
        不需要写长笔记。只有进入准备验证或已验证状态的项目，才进入这里形成长期结论。
      </p>

      {message && (
        <div
          className="mt-6 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-bold text-ink"
          role="status"
        >
          {message}
        </div>
      )}

      {!workspace ? (
        <div className="grid min-h-96 place-items-center">
          <LoaderCircle size={30} className="animate-spin text-signal" />
        </div>
      ) : entries.length ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="knowledge-list">
            <div className="border-b border-line p-4">
              <p className="panel-kicker">VERIFICATION QUEUE</p>
              <p className="mt-2 text-sm font-black text-ink">
                待验证 {workspace.toVerify.length} · 已验证{' '}
                {workspace.verified.length}
              </p>
            </div>
            <div className="max-h-[48rem] overflow-y-auto">
              {entries.map((entry) => {
                const active = entry.repository.githubId === activeId
                return (
                  <button
                    key={entry.repository.githubId}
                    type="button"
                    className={`knowledge-list-item ${active ? 'knowledge-list-item-active' : ''}`}
                    onClick={() => activate(entry)}
                  >
                    <span className="flex items-center gap-2">
                      {entry.metadata.lifecycleStatus === 'verified' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <FlaskConical size={14} />
                      )}
                      <strong className="truncate">
                        {entry.repository.fullName}
                      </strong>
                    </span>
                    <small>
                      {entry.metadata.lifecycleStatus === 'verified'
                        ? '已验证'
                        : '准备验证'}
                    </small>
                  </button>
                )
              })}
            </div>
          </aside>

          {activeEntry && (
            <div className="knowledge-editor">
              <div className="flex flex-col justify-between gap-4 border-b border-line p-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="panel-kicker">YOUR CONCLUSION</p>
                  <h2 className="mt-2 break-all text-2xl font-black text-ink">
                    {activeEntry.repository.fullName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {activeEntry.repository.description || '没有 Description。'}
                  </p>
                </div>
                <a
                  href={activeEntry.repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary shrink-0"
                >
                  GitHub <ExternalLink size={14} />
                </a>
              </div>

              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <label className="review-field sm:col-span-2">
                  <span>一句话用途</span>
                  <input
                    value={draft.customSummary}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        customSummary: event.target.value,
                      }))
                    }
                    placeholder="它具体解决什么问题？"
                  />
                </label>
                <label className="review-field sm:col-span-2">
                  <span>为什么收藏</span>
                  <textarea
                    rows={3}
                    value={draft.whyStarred}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        whyStarred: event.target.value,
                      }))
                    }
                    placeholder="当时准备和什么方案比较？"
                  />
                </label>
                <label className="review-field">
                  <span>适用场景</span>
                  <textarea
                    rows={4}
                    value={draft.useCases}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        useCases: event.target.value,
                      }))
                    }
                    placeholder="在哪些真实场景下值得使用？"
                  />
                </label>
                <label className="review-field">
                  <span>替代方案</span>
                  <textarea
                    rows={4}
                    value={draft.alternatives}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        alternatives: event.target.value,
                      }))
                    }
                    placeholder="比较过哪些类似项目？"
                  />
                </label>
                <label className="review-field sm:col-span-2">
                  <span className="inline-flex items-center gap-2">
                    <BookOpenCheck size={14} /> 我的结论（必填）
                  </span>
                  <textarea
                    rows={5}
                    value={draft.verificationSummary}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        verificationSummary: event.target.value,
                      }))
                    }
                    placeholder="安装、试用或比较之后，你最终留下了什么判断？"
                  />
                </label>
                <label className="review-field sm:col-span-2">
                  <span className="inline-flex items-center gap-2">
                    <Tags size={14} /> 标签
                  </span>
                  <input
                    value={draft.tags}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        tags: event.target.value,
                      }))
                    }
                    placeholder="AI, CLI, Local-first"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-between gap-3 border-t border-line bg-paper p-5">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={activeEntry.metadata.lifecycleStatus !== 'verified'}
                  onClick={exportSingle}
                >
                  <FileText size={16} /> 导出 Obsidian 笔记
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={saving || !draft.verificationSummary.trim()}
                  onClick={() => void handleSave()}
                >
                  {saving ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  保存并标记已验证
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="review-empty-state">
          <BookOpenCheck size={30} />
          <h2>还没有准备验证的项目</h2>
          <p>
            从 Smart Triage、Ask My Stars 或 Forgotten Gems
            选择值得试用的项目后，它们会进入这里。
          </p>
        </div>
      )}

      {workspace && workspace.verified.length > 0 && (
        <section className="mt-8 rounded-2xl border border-ink bg-accent p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="panel-kicker">KNOWLEDGE EXPORT</p>
              <h2 className="mt-2 text-2xl font-black text-ink">
                导出已验证项目合集
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
                默认排除私有仓库。私人备注不会单独出现在合集，只导出你写入“我的结论”的内容。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {workspace.verified.map((entry) => (
                  <label
                    key={entry.repository.githubId}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/55 px-3 py-2 text-xs font-bold text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.repository.githubId)}
                      onChange={(event) =>
                        setSelected((previous) => {
                          const next = new Set(previous)
                          if (event.target.checked)
                            next.add(entry.repository.githubId)
                          else next.delete(entry.repository.githubId)
                          return next
                        })
                      }
                    />
                    {entry.repository.fullName}
                  </label>
                ))}
              </div>
              <label className="mt-4 flex items-start gap-2 text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={includePrivate}
                  onChange={(event) => setIncludePrivate(event.target.checked)}
                />
                <ShieldAlert size={14} /> 我确认要在本地知识导出中包含私有仓库
              </label>
            </div>
            <button
              type="button"
              className="button-primary"
              disabled={!exportEntries.length}
              onClick={exportCollection}
            >
              <Download size={17} /> 导出 {exportEntries.length} 个项目
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
