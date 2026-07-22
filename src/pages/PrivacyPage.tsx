import { Database, Eye, KeyRound, ServerOff } from 'lucide-react'
import { Link } from 'react-router-dom'

const sections = [
  {
    icon: KeyRound,
    title: 'Token 只存在页面内存',
    body: 'Token 只由当前 React 会话持有，用于浏览器直接请求 GitHub。它不会写入 localStorage、sessionStorage、IndexedDB、URL、日志、导出文件或错误信息。刷新或关闭页面后，Token 消失。',
  },
  {
    icon: Eye,
    title: '默认只读，写入必须显式开启',
    body: '导入只调用 GET /user 和 GET /user/starred。只有 Action Center 展示完整计划、用户选择操作、提供内存 Token、勾选确认并输入 EXECUTE 后，才调用官方 Star/Unstar 接口。',
  },
  {
    icon: Database,
    title: '业务数据留在浏览器',
    body: '仓库基础元数据、导入快照以及后续用户整理结果保存在当前浏览器的 IndexedDB。不同浏览器和设备之间不会自动同步。',
  },
  {
    icon: ServerOff,
    title: '没有业务后端',
    body: '应用可以作为纯静态网站部署。没有产品账号、云端数据库或第三方分析脚本；产品服务器不接触 Token 和 Stars 数据。',
  },
]

export function PrivacyPage() {
  return (
    <section className="page-shell py-14 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="eyebrow mb-5">PRIVACY BY ARCHITECTURE</div>
        <h1 className="max-w-3xl text-4xl font-black tracking-[-0.05em] text-ink sm:text-6xl">
          你的 Token 和 Stars，
          <br />
          都不属于我们。
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          Star Inbox 的隐私边界由数据流决定，而不是依赖一份“请相信我们”的承诺。
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, body }, index) => (
            <article
              key={title}
              className="rounded-2xl border border-line bg-white/75 p-6"
            >
              <div className="flex items-start justify-between">
                <Icon size={22} className="text-signal" />
                <span className="font-mono text-[10px] font-bold text-muted/50">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-8 text-lg font-extrabold tracking-tight text-ink">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-ink bg-ink p-7 text-paper sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="font-serif text-2xl">准备好后，从只读导入开始。</p>
            <p className="mt-2 text-sm text-paper/65">
              导入只需 Starring: Read；Action Mode 使用独立、短期的 Starring:
              Read and write Token。
            </p>
          </div>
          <Link
            to="/import"
            className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-ink sm:mt-0"
          >
            前往导入
          </Link>
        </div>
      </div>
    </section>
  )
}
