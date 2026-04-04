'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard, Calendar, Users, ArrowLeftRight,
  BarChart2, ClipboardList, Bell, Menu, X, Clock, Zap, MapPin
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { href: '/schedule', icon: Calendar, label: 'Schedule', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { href: '/shifts', icon: Clock, label: 'Shifts', roles: ['ADMIN', 'MANAGER'] },
  { href: '/staff', icon: Users, label: 'Staff', roles: ['ADMIN', 'MANAGER'] },
  { href: '/swaps', icon: ArrowLeftRight, label: 'Swaps & Coverage', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { href: '/locations', icon: MapPin, label: 'Locations', roles: ['ADMIN'] },
  { href: '/analytics', icon: BarChart2, label: 'Analytics', roles: ['ADMIN', 'MANAGER'] },
  { href: '/audit', icon: ClipboardList, label: 'Audit Log', roles: ['ADMIN', 'MANAGER'] },
  { href: '/notifications', icon: Bell, label: 'Notifications', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
]

const roleColors: Record<string, string> = {
  ADMIN: 'bg-violet-500/20 text-violet-300',
  MANAGER: 'bg-blue-500/20 text-blue-300',
  STAFF: 'bg-emerald-500/20 text-emerald-300',
}

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role as string
  const [mobileOpen, setMobileOpen] = useState(false)

  const filtered = navItems.filter((item) => item.roles.includes(role))

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <Zap className="h-4 w-4 fill-white" />
            </div>
          </div>
          <div>
            <p className="font-bold text-white text-sm tracking-tight">ShiftSync</p>
            <p className="text-[11px] text-slate-400 font-medium">Coastal Eats</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/8 mb-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {filtered.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-white/12 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/6 hover:text-slate-200'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')} />
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom user section */}
      <div className="mx-4 h-px bg-white/8 mt-3 mb-3" />
      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/6 hover:bg-white/10 transition-colors cursor-default">
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            {getInitials(session?.user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{role?.toLowerCase()}</p>
          </div>
          <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded', roleColors[role] ?? 'bg-slate-500/20 text-slate-300')}>
            {role ? role.charAt(0) + role.slice(1).toLowerCase() : ''}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[220px] h-screen sticky top-0 shrink-0"
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}
      >
        <NavContent />
      </aside>

      {/* Mobile burger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl shadow-lg border border-white/10 text-white"
        style={{ background: '#0f172a' }}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[220px] h-full overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}>
            <NavContent />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
