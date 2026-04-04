'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, ArrowLeftRight, AlertTriangle, Star, MapPin, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useSSE } from '@/hooks/useSSE'
import type { SSEEvent } from '@/types'

function formatTime(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
  } catch {
    return new Date(iso).toLocaleTimeString()
  }
}

function formatDateTime(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: tz,
      timeZoneName: 'short',
    })
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = session?.user?.role as string | undefined

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Live updates — refresh on any shift/swap/assignment event
  useSSE((event: SSEEvent) => {
    if (
      event.type === 'SHIFT_UPDATED' ||
      event.type === 'ASSIGNMENT_CHANGED' ||
      event.type === 'SWAP_REQUEST' ||
      event.type === 'SCHEDULE_PUBLISHED' ||
      event.type === 'CONFLICT_ALERT'
    ) {
      loadData()
    }
  })

  // Also refresh every 60s so "on duty now" stays accurate as shifts start/end
  useEffect(() => {
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  const onDuty = data?.onDuty ?? []
  const upcomingShifts = data?.upcomingShifts ?? []
  const pendingSwaps = data?.pendingSwaps ?? []
  const weeklyHours: number = data?.weeklyHours ?? 0

  const stats = [
    { icon: Users, label: 'On Duty Now', value: onDuty.length, iconClass: 'text-emerald-600', bgClass: 'bg-emerald-50' },
    { icon: Clock, label: 'Your Hours This Week', value: `${weeklyHours.toFixed(1)}h`, iconClass: 'text-indigo-600', bgClass: 'bg-indigo-50' },
    { icon: ArrowLeftRight, label: 'Pending Swaps', value: pendingSwaps.length, iconClass: 'text-amber-600', bgClass: 'bg-amber-50' },
    {
      icon: AlertTriangle,
      label: 'Overtime This Week',
      value: `${Math.max(0, weeklyHours - 40).toFixed(1)}h`,
      iconClass: weeklyHours >= 40 ? 'text-red-600' : 'text-slate-400',
      bgClass: weeklyHours >= 40 ? 'bg-red-50' : 'bg-slate-50',
    },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Dashboard" />
      <main className="flex-1 p-4 lg:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ icon: Icon, label, value, iconClass, bgClass }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${bgClass} shrink-0`}>
                    <Icon className={`h-5 w-5 ${iconClass}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">
                      {loading ? <span className="inline-block h-6 w-12 bg-muted animate-pulse rounded" /> : value}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* On Duty Now — live */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">On Duty Right Now</CardTitle>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : onDuty.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active shifts right now</p>
              ) : (
                <div className="space-y-2">
                  {onDuty.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{a.user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{a.shift.location.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">{a.shift.skill.name}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Until {formatTime(a.shift.endTime, a.shift.location.timezone)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Shifts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Upcoming Shifts</CardTitle>
                <Link href="/schedule">
                  <Button variant="ghost" size="sm" className="text-xs">View all</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : upcomingShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming shifts this week</p>
              ) : (
                <div className="space-y-2">
                  {upcomingShifts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {a.shift.isPremium && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                          {a.shift.skill.name}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(a.shift.startTime, a.shift.location.timezone)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{a.shift.location.name.split(' ')[0]}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Swaps */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pending Swaps & Coverage</CardTitle>
                <Link href="/swaps">
                  <Button variant="ghost" size="sm" className="text-xs">View all</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : pendingSwaps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {pendingSwaps.map((s: any) => (
                    <div key={s.id} className="flex items-start justify-between py-2 border-b last:border-0 gap-2">
                      <div>
                        <p className="text-sm font-medium">{s.requester.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.type === 'DROP' ? 'Drop request' : `Swap with ${s.target?.name}`} · {s.shift.location.name}
                        </p>
                      </div>
                      <Badge variant={s.status === 'ACCEPTED' ? 'success' : 'warning'} className="text-xs shrink-0">
                        {s.status === 'ACCEPTED' ? 'Needs approval' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions — managers/admins only */}
          {(role === 'MANAGER' || role === 'ADMIN') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Link href="/schedule">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Calendar className="h-4 w-4" /> Schedule
                  </Button>
                </Link>
                <Link href="/shifts">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Clock className="h-4 w-4" /> Manage Shifts
                  </Button>
                </Link>
                <Link href="/staff">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" /> Staff
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <AlertTriangle className="h-4 w-4" /> Analytics
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
