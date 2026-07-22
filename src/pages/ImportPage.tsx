import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  GitFork,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Square,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GITHUB_TOKEN_TEMPLATE_URL, TokenGuide } from '../components/TokenGuide'
import type { AuthenticatedGitHubUser } from '../domain/import'
import {
  ImportCancelledError,
  ImportStarsError,
  importStars,
} from '../features/github-import/import-stars'
import { githubClient, GitHubApiError } from '../github/client'
import type { ImportPageProgress } from '../github/pagination'
import { useTokenSession } from '../security/token-session'

type ImportPhase =
  'idle' | 'validating' | 'ready' | 'importing' | 'failed' | 'cancelled'

interface ResumeState {
  snapshotId: string
  page: number
}

const emptyProgress: ImportPageProgress = {
  page: 0,
  importedCount: 0,
  pageSize: 0,
}

const TOKEN_VALIDATION_DIAGNOSTIC_PREFIX = '[Star Inbox][Token validation]'

function logTokenValidationDiagnostic(
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, boolean | number | string | undefined> = {},
) {
  console[level](
    `${TOKEN_VALIDATION_DIAGNOSTIC_PREFIX} ${event}`,
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  )
}

export function ImportPage() {
  const navigate = useNavigate()
  const { token: sessionToken, setToken, clearToken } = useTokenSession()
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [user, setUser] = useState<AuthenticatedGitHubUser | null>(null)
  const [progress, setProgress] = useState<ImportPageProgress>(emptyProgress)
  const [errorMessage, setErrorMessage] = useState('')
  const [resume, setResume] = useState<ResumeState | null>(null)
  const validationController = useRef<AbortController | null>(null)
  const importController = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      validationController.current?.abort()
      importController.current?.abort()
    },
    [],
  )

  const updateProgress = useCallback((nextProgress: ImportPageProgress) => {
    setProgress(nextProgress)
  }, [])

  async function handleValidate() {
    const candidate = tokenInput.trim()
    logTokenValidationDiagnostic('info', 'button_clicked', {
      browserOnline: navigator.onLine,
      origin: window.location.origin,
      hasTokenInput: Boolean(candidate),
    })

    if (!candidate) {
      logTokenValidationDiagnostic('warn', 'input_missing')
      setErrorMessage('请先粘贴 GitHub Token。')
      return
    }

    validationController.current?.abort()
    const controller = new AbortController()
    validationController.current = controller
    setPhase('validating')
    setErrorMessage('')
    logTokenValidationDiagnostic('info', 'validation_started')

    try {
      const authenticatedUser = await githubClient.validateToken(
        candidate,
        controller.signal,
      )
      setToken(candidate)
      setUser(authenticatedUser)
      setTokenInput('')
      setPhase('ready')
      logTokenValidationDiagnostic('info', 'validation_succeeded')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        logTokenValidationDiagnostic('warn', 'validation_aborted')
        return
      }
      logTokenValidationDiagnostic('error', 'validation_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        status: error instanceof GitHubApiError ? error.status : undefined,
      })
      setPhase('idle')
      setErrorMessage(
        error instanceof GitHubApiError
          ? error.message
          : 'Token 验证失败，请稍后重试。',
      )
    }
  }

  async function runImport(resumeState?: ResumeState) {
    if (!sessionToken || !user) {
      setErrorMessage('Token 已从内存中消失，请重新验证。')
      setPhase('idle')
      return
    }

    const controller = new AbortController()
    importController.current = controller
    setPhase('importing')
    setErrorMessage('')

    try {
      const result = await importStars({
        token: sessionToken,
        user,
        snapshotId: resumeState?.snapshotId,
        startPage: resumeState?.page,
        signal: controller.signal,
        onProgress: updateProgress,
      })
      setResume(null)
      await navigate('/dashboard', {
        replace: true,
        state: { importedCount: result.repositoryCount },
      })
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        setPhase('cancelled')
        setResume({
          snapshotId: error.snapshotId,
          page: error.nextPage,
        })
        return
      }
      if (error instanceof ImportStarsError) {
        setPhase('failed')
        setErrorMessage(error.message)
        setResume({ snapshotId: error.snapshotId, page: error.failedPage })
        return
      }
      setPhase('failed')
      setErrorMessage('导入未完成，请重试。')
    }
  }

  function handleCancel() {
    importController.current?.abort()
  }

  function handleReset() {
    clearToken()
    setTokenInput('')
    setUser(null)
    setProgress(emptyProgress)
    setResume(null)
    setErrorMessage('')
    setPhase('idle')
  }

  const isBusy = phase === 'validating' || phase === 'importing'
  const progressPercent = progress.totalPages
    ? Math.min((progress.page / progress.totalPages) * 100, 100)
    : progress.page > 0
      ? Math.min(12 + progress.page * 5, 88)
      : 0

  return (
    <section className="page-shell py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="eyebrow mb-4">M1 · PRIVATE IMPORT</div>
            <h1 className="text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">
              把 Stars 带回你的浏览器。
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              浏览器将直接连接 GitHub，逐页读取你收藏的仓库。Token
              不会写入本地数据库，也不会经过产品服务器。
            </p>
          </div>
          <div className="hidden rounded-xl border border-line bg-paper px-4 py-3 text-right md:block">
            <p className="text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">
              Import route
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-ink">
              GitHub → Browser
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="order-2 lg:order-1">
            <div className="sticky top-24">
              <TokenGuide />
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-950">
                  <ShieldCheck size={15} /> 仍然由你最后确认
                </div>
                <p className="mt-2 text-[11px] leading-5 text-emerald-900/70">
                  快捷链接只预填表单，不会替你创建 Token，也不会让 Star Inbox
                  看到生成过程。
                </p>
              </div>
            </div>
          </aside>

          <div className="order-1 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_70px_rgba(31,35,31,0.07)] lg:order-2">
            <div className="flex items-center justify-between border-b border-line bg-paper/70 px-6 py-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
                <GitFork size={18} /> GitHub 连接
              </div>
              <span className={`status-dot ${isBusy ? 'status-dot-live' : ''}`}>
                <span
                  className={
                    phase === 'ready' || phase === 'importing'
                      ? 'bg-emerald-600'
                      : 'bg-stone-400'
                  }
                />
                {phase === 'ready' || phase === 'importing'
                  ? '已验证'
                  : '未连接'}
              </span>
            </div>

            <div className="p-6 sm:p-8">
              {(phase === 'idle' || phase === 'validating') && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="github-token" className="field-label">
                      GitHub Personal Access Token
                    </label>
                    <a
                      href={GITHUB_TOKEN_TEMPLATE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-signal hover:underline"
                    >
                      没有 Token？一键创建 <ArrowRight size={12} />
                    </a>
                  </div>
                  <div className="token-field mt-2">
                    <KeyRound size={18} className="shrink-0 text-muted" />
                    <input
                      id="github-token"
                      type={showToken ? 'text' : 'password'}
                      value={tokenInput}
                      onChange={(event) => setTokenInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !isBusy)
                          void handleValidate()
                      }}
                      placeholder="github_pat_••••••••••••••••"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-1p-ignore
                      data-lpignore="true"
                      data-bwignore="true"
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((current) => !current)}
                      className="icon-button"
                      aria-label={showToken ? '隐藏 Token' : '显示 Token'}
                    >
                      {showToken ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <ShieldCheck size={13} className="text-emerald-700" />
                    Token 刷新页面后会清除；已导入数据和回顾结果不会丢失。
                  </p>
                  {errorMessage && (
                    <div className="error-banner mt-5" role="alert">
                      <AlertCircle size={17} /> {errorMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    className="button-primary mt-7 w-full justify-center"
                    onClick={() => void handleValidate()}
                    disabled={isBusy || !tokenInput.trim()}
                  >
                    {phase === 'validating' ? (
                      <>
                        <LoaderCircle size={17} className="animate-spin" />{' '}
                        验证中
                      </>
                    ) : (
                      <>
                        验证只读连接 <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {phase === 'ready' && user && (
                <div>
                  <div className="success-account">
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-12 w-12 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
                        @{user.login}{' '}
                        <CheckCircle2 size={15} className="text-emerald-700" />
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Token 验证成功，可以开始读取 Stars。
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 rounded-xl border border-line bg-paper/60 p-4 text-sm leading-6 text-muted">
                    每页最多读取 100
                    个仓库。失败页面会自动重试；仍然失败时，你可以从该页继续，无需重头开始。
                  </div>
                  <button
                    type="button"
                    className="button-primary mt-6 w-full justify-center"
                    onClick={() => void runImport()}
                  >
                    开始导入全部 Stars <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="text-button mx-auto mt-4"
                    onClick={handleReset}
                  >
                    更换 Token
                  </button>
                </div>
              )}

              {phase === 'importing' && (
                <div aria-live="polite" className="import-state-enter">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="eyebrow">IMPORTING</p>
                      <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">
                        正在整理收件箱
                      </h2>
                      <p className="mt-2 text-sm text-muted">
                        已写入暂存区 {progress.importedCount.toLocaleString()}{' '}
                        个仓库
                      </p>
                    </div>
                    <span className="import-loader-orbit" aria-hidden="true">
                      <span>★</span>
                    </span>
                  </div>
                  <div className="progress-track mt-8 h-2 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="progress-fill h-full rounded-full bg-signal transition-[width] duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between font-mono text-[11px] font-bold text-muted">
                    <span>PAGE {Math.max(progress.page, 1)}</span>
                    <span>
                      {progress.totalPages
                        ? `${Math.round(progressPercent)}%`
                        : 'SCANNING'}
                    </span>
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="import-stat">
                      <span>{progress.importedCount.toLocaleString()}</span>
                      <small>已获取</small>
                    </div>
                    <div className="import-stat">
                      <span>{progress.page || '—'}</span>
                      <small>完成页</small>
                    </div>
                    <div className="import-stat">
                      <span>{progress.pageSize || '—'}</span>
                      <small>本页</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button-danger mt-7 w-full justify-center"
                    onClick={handleCancel}
                  >
                    <Square size={13} fill="currentColor" /> 取消导入
                  </button>
                </div>
              )}

              {(phase === 'failed' || phase === 'cancelled') && (
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                    {phase === 'failed' ? (
                      <AlertCircle size={26} />
                    ) : (
                      <CircleDashed size={26} />
                    )}
                  </div>
                  <h2 className="mt-5 text-2xl font-black tracking-tight text-ink">
                    {phase === 'failed' ? '这一页没有完成' : '导入已取消'}
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
                    {errorMessage ||
                      '已完成的页面仍保存在本地暂存区，可以稍后继续。'}
                  </p>
                  {resume && (
                    <button
                      type="button"
                      className="button-primary mt-7 w-full justify-center"
                      onClick={() => void runImport(resume)}
                    >
                      <RotateCcw size={17} /> 从第 {resume.page} 页重试
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button mx-auto mt-4"
                    onClick={handleReset}
                  >
                    重新验证 Token
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Check size={13} className="text-emerald-700" /> 不请求
            README、Release、Issue 或源码
          </span>
          <Link to="/" className="font-bold hover:text-ink">
            返回产品说明
          </Link>
        </div>
      </div>
    </section>
  )
}
