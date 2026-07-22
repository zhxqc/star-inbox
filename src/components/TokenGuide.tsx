import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  Clock3,
  KeyRound,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

export const GITHUB_TOKEN_TEMPLATE_URL =
  'https://github.com/settings/personal-access-tokens/new?name=Star%20Inbox&description=Read%20your%20GitHub%20Stars%20in%20the%20local-first%20Star%20Inbox%20app&expires_in=30&starring=read'

export const GITHUB_WRITE_TOKEN_TEMPLATE_URL =
  'https://github.com/settings/personal-access-tokens/new?name=Star%20Inbox%20Action%20Mode&description=Execute%20only%20the%20Star%20or%20Unstar%20actions%20you%20confirm%20in%20Star%20Inbox&expires_in=7&starring=write'

const steps = [
  {
    icon: UserRound,
    title: '确认资源所有者',
    body: '保持为你自己的 GitHub 账号。',
  },
  {
    icon: Clock3,
    title: '确认有效期',
    body: '快捷入口默认填写 30 天，可自行缩短。',
  },
  {
    icon: ShieldCheck,
    title: '检查唯一权限',
    body: 'Account permissions → Starring → Read-only。',
  },
  {
    icon: KeyRound,
    title: '生成并复制',
    body: '点击 Generate token，并立即复制一次。',
  },
]

export function TokenGuide() {
  return (
    <div className="token-guide">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <BookOpenCheck size={18} className="text-signal" />2 分钟获取 Token
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            GitHub 会预填名称、30 天有效期和唯一所需的只读权限。
          </p>
        </div>
        <span className="rounded-full bg-accent px-2 py-1 font-mono text-[9px] font-black tracking-wider text-ink">
          READ ONLY
        </span>
      </div>

      <a
        className="token-create-button mt-5"
        href={GITHUB_TOKEN_TEMPLATE_URL}
        target="_blank"
        rel="noreferrer"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
          <KeyRound size={16} />
        </span>
        <span className="flex-1 text-left">
          <strong className="block text-sm">一键打开创建页面</strong>
          <small className="mt-0.5 block text-[10px] font-medium text-white/60">
            在 GitHub 新标签页中打开
          </small>
        </span>
        <ArrowUpRight size={17} />
      </a>

      <div className="token-visual-guide mt-5" aria-label="Token 创建步骤示例">
        <div className="token-visual-bar">
          <span />
          <span />
          <span />
          <p>github.com / Fine-grained token</p>
        </div>
        <div className="p-3">
          <div className="token-visual-field">
            <span>Token name</span>
            <strong>Star Inbox</strong>
            <Check size={13} />
          </div>
          <div className="token-visual-field mt-2">
            <span>Account permission</span>
            <strong>Starring</strong>
            <em>Read-only</em>
          </div>
        </div>
      </div>

      <details className="token-guide-details mt-4">
        <summary>查看完整文字教程</summary>
        <ol className="mt-4 space-y-4">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="grid grid-cols-[1.8rem_1fr] gap-3">
              <span className="token-step-number">
                <Icon size={13} />
              </span>
              <div>
                <p className="text-xs font-extrabold text-ink">
                  {index + 1}. {title}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <a
          href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-signal hover:underline"
        >
          阅读 GitHub 官方教程 <ArrowUpRight size={12} />
        </a>
      </details>
    </div>
  )
}
