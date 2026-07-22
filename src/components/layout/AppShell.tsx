import { Database, GitFork, ShieldCheck } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-link ${isActive ? 'nav-link-active' : ''}`
}

export function AppShell() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="site-header">
        <div className="page-shell flex h-18 items-center justify-between gap-6">
          <Link
            to="/"
            className="group flex items-center gap-3"
            aria-label="Star Inbox 首页"
          >
            <span className="brand-mark" aria-hidden="true">
              <span>★</span>
            </span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.02em] text-ink">
                Star Inbox
              </span>
              <span className="hidden text-[10px] font-bold tracking-[0.17em] text-muted uppercase sm:block">
                Review what you save
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="主导航"
          >
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/triage" className={navClass}>
              整理
            </NavLink>
            <NavLink to="/ask" className={navClass}>
              搜索
            </NavLink>
            <NavLink to="/actions" className={navClass}>
              行动
            </NavLink>
            <NavLink to="/knowledge" className={navClass}>
              知识
            </NavLink>
          </nav>

          <nav
            className="flex items-center gap-1 md:hidden"
            aria-label="移动端主导航"
          >
            <NavLink to="/dashboard" className={navClass}>
              总览
            </NavLink>
            <NavLink to="/triage" className={navClass}>
              整理
            </NavLink>
            <NavLink to="/ask" className={navClass}>
              搜索
            </NavLink>
            <NavLink to="/actions" className={navClass}>
              行动
            </NavLink>
            <NavLink to="/knowledge" className={navClass}>
              知识
            </NavLink>
          </nav>

          <div className="hidden items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted lg:flex">
            <ShieldCheck size={14} className="text-emerald-700" />
            Token 仅存在内存
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div
          key={location.pathname}
          className="route-enter flex flex-1 flex-col"
        >
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line/80 bg-paper py-8">
        <div className="page-shell flex flex-col justify-between gap-4 text-xs text-muted sm:flex-row sm:items-center">
          <p>Star Inbox · GitHub Star 是收件箱，不是知识库。</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="font-bold hover:text-ink">
              隐私说明
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <GitFork size={13} /> GitHub 默认只读
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Database size={13} /> 数据留在浏览器
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
