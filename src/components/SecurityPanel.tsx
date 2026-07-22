import { Database, Eye, ServerOff, ShieldCheck } from 'lucide-react'

const boundaries = [
  { icon: ShieldCheck, label: 'Token 仅在当前页面内存中' },
  { icon: Database, label: 'Stars 写入浏览器 IndexedDB' },
  { icon: Eye, label: '默认只读，写入必须显式确认' },
  { icon: ServerOff, label: '无账号、无业务后端' },
]

export function SecurityPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2'
      }
    >
      {boundaries.map(({ icon: Icon, label }) => (
        <div key={label} className="security-item">
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
