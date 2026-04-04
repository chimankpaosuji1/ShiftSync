'use client'
import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/notifications?unread=true&take=1')
      .then((r) => r.json())
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => {})
  }, [])

  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left: title */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden w-8" />
        {title && (
          <h1 className="font-semibold text-base tracking-tight hidden lg:block">{title}</h1>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* Avatar / profile */}
        <Link href="/profile">
          <button className="h-8 w-8 rounded-full ml-1 flex items-center justify-center text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
            title={session?.user?.name ?? ''}
          >
            {getInitials(session?.user?.name)}
          </button>
        </Link>

        {/* Sign out */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg ml-1 text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
