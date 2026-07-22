import {
  ArrowRight,
  Check,
  Clock3,
  Inbox,
  LibraryBig,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SecurityPanel } from '../components/SecurityPanel'

const lifecycle = ['Star', 'Inbox', 'Review', 'Try', 'Verify', 'Knowledge']

const promises = [
  {
    icon: Inbox,
    title: '先回答为什么收藏',
    body: '把模糊的 Star 变成准备试用、参考资料、正在使用，或只是暂时关注。',
  },
  {
    icon: RotateCcw,
    title: '让旧项目重新出现',
    body: '按收藏时间、活跃度和处理状态回看，而不是继续堆更多文件夹。',
  },
  {
    icon: LibraryBig,
    title: '只沉淀验证过的内容',
    body: 'Star Inbox 负责筛选，真正有结论的项目再导出到你的长期知识库。',
  },
]

export function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div className="hero-grid" aria-hidden="true" />
        <div className="page-shell relative grid gap-12 py-18 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-26">
          <div>
            <div className="eyebrow mb-6">
              <span className="h-2 w-2 rounded-full bg-signal" />
              LOCAL-FIRST · READ-ONLY BY DEFAULT · ZERO BACKEND
            </div>
            <h1 className="max-w-3xl text-[clamp(3.2rem,8vw,6.8rem)] leading-[0.88] font-black tracking-[-0.075em] text-ink">
              你的 Stars
              <span className="mt-2 block font-serif font-normal tracking-[-0.055em] text-signal italic">
                不缺收藏。
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted sm:text-xl">
              缺的是少量、明确、可执行的决定。Star Inbox
              自动生成可解释队列，帮你批量清理、按问题搜索、重新发现，并把验证结论带进知识库。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/import" className="button-primary">
                开始整理我的 GitHub Stars
                <ArrowRight size={18} />
              </Link>
              <a href="#privacy" className="button-secondary">
                查看隐私边界
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted">
              <Check size={14} className="text-emerald-700" />
              无需安装 · 无需注册 · 写入只在显式 Action Mode 中发生
            </p>
          </div>

          <div className="relative lg:pl-8">
            <div className="inbox-preview">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.18em] text-muted uppercase">
                    Today’s review
                  </p>
                  <p className="mt-1 font-serif text-2xl text-ink">
                    12 items waiting
                  </p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-black text-paper">
                  12
                </span>
              </div>
              <div className="p-5">
                <div className="repo-card-active">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-signal">
                        microsoft / markitdown
                      </p>
                      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">
                        为什么保存它？
                      </h2>
                    </div>
                    <Sparkles size={18} className="text-signal" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Python tool for converting files and office documents to
                    Markdown.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['准备试用', '参考资料', '正在使用', '内容素材'].map(
                      (label, index) => (
                        <span
                          key={label}
                          className={
                            index === 0
                              ? 'intent-pill intent-pill-active'
                              : 'intent-pill'
                          }
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="mini-stat">
                    <span>2,431</span>
                    <small>ALL STARS</small>
                  </div>
                  <div className="mini-stat">
                    <span>417</span>
                    <small>UNREVIEWED</small>
                  </div>
                  <div className="mini-stat">
                    <span>28</span>
                    <small>VERIFIED</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-3 -bottom-5 hidden rotate-2 rounded-xl border border-ink bg-accent px-5 py-3 text-sm font-black text-ink shadow-[4px_4px_0_#1c211d] sm:block">
              收藏不是结论。
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink py-6 text-paper">
        <div className="page-shell flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:justify-between">
          {lifecycle.map((item, index) => (
            <div key={item} className="flex items-center gap-3">
              <span
                className={
                  index === 0 ? 'lifecycle-step text-accent' : 'lifecycle-step'
                }
              >
                {item}
              </span>
              {index < lifecycle.length - 1 && (
                <ArrowRight
                  size={14}
                  className="text-paper/35"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell py-20 lg:py-26">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow">THE REAL JOB</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight text-ink sm:text-5xl">
              不再管理收藏，
              <br />
              开始处理收藏。
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }, index) => (
              <article key={title} className="bg-canvas p-7">
                <div className="mb-9 flex items-start justify-between">
                  <Icon size={23} className="text-signal" />
                  <span className="font-mono text-xs font-bold text-muted/60">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-ink">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="border-y border-line bg-paper py-18">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-emerald-100 uppercase">
              <Clock3 size={13} /> Privacy by architecture
            </div>
            <h2 className="max-w-xl text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">
              不是“承诺不看”，
              <br />
              而是没有地方可看。
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-muted">
              浏览器直接请求 GitHub。产品没有账号系统、没有业务数据库，也不会把
              Token 放进任何持久化存储。
            </p>
          </div>
          <SecurityPanel />
        </div>
      </section>
    </>
  )
}
