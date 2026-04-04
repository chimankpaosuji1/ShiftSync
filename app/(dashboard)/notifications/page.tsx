'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSSE } from '@/hooks/useSSE'
import { Bell, CheckCheck } from 'lucide-react'

const TYPE_ICONS: Record<string, string> = {
  SHIFT_ASSIGNED: '📅',
  SHIFT_CHANGED: '✏️',
  SHIFT_CANCELLED: '❌',
  SCHEDULE_PUBLISHED: '📣',
  SWAP_REQUEST_RECEIVED: '🔄',
  SWAP_ACCEPTED: '✅',
  SWAP_APPROVED: '✅',
  SWAP_REJECTED: '❌',
  SWAP_CANCELLED: '↩️',
  DROP_REQUEST: '⬇️',
  DROP_CLAIMED: '🙋',
  OVERTIME_WARNING: '⚠️',
  AVAILABILITY_CHANGED: '🗓️',
  COVERAGE_NEEDED: '🆘',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    const data = await fetch('/api/notifications?take=100').then((r) => r.json())
    setNotifications(data.notifications || [])
    setUnreadCount(data.unreadCount || 0)
    setLoading(false)
  }, [])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  useSSE((event) => {
    if (event.type === 'NOTIFICATION') loadNotifications()
  })

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    loadNotifications()
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Notifications" />
      <main className="flex-1 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="font-semibold">Notifications</h2>
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card
                key={n.id}
                className={`hover:shadow-sm transition-all cursor-pointer ${!n.isRead ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
