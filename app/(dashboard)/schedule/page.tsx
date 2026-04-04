'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShiftCard } from '@/components/shifts/shift-card'
import { AssignDialog } from '@/components/shifts/assign-dialog'
import { useToast } from '@/components/ui/toast'
import { useSSE } from '@/hooks/useSSE'
import { ChevronLeft, ChevronRight, Plus, Eye, AlertTriangle, Loader2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import type { ShiftSummary, SSEEvent } from '@/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(d.getUTCDate() + i)
    return d
  })
}

export default function SchedulePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const role = session?.user?.role as string
  const userId = session?.user?.id as string

  const [currentWeek, setCurrentWeek] = useState<Date>(() => {
    const now = new Date()
    const day = now.getUTCDay()
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1))
    monday.setUTCHours(0, 0, 0, 0)
    return monday
  })
  const [locations, setLocations] = useState<{ id: string; name: string; timezone: string }[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [shifts, setShifts] = useState<ShiftSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [assignTarget, setAssignTarget] = useState<ShiftSummary | null>(null)
  const [overtimeWarnings, setOvertimeWarnings] = useState<{ userName: string; weeklyHours: number }[]>([])

  useEffect(() => {
    fetch('/api/locations')
      .then((r) => r.json())
      .then((data) => {
        setLocations(data)
        if (data.length > 0) setSelectedLocation(data[0].id)
      })
  }, [])

  const loadShifts = useCallback(async () => {
    if (!selectedLocation) return
    setLoading(true)
    const weekEnd = new Date(currentWeek)
    weekEnd.setUTCDate(currentWeek.getUTCDate() + 6)
    weekEnd.setUTCHours(23, 59, 59, 999)

    try {
      const r = await fetch(
        `/api/shifts?locationId=${selectedLocation}&weekStart=${currentWeek.toISOString()}&weekEnd=${weekEnd.toISOString()}`
      )
      const data = await r.json()
      setShifts(Array.isArray(data) ? data : [])

      if (role !== 'STAFF') {
        const otR = await fetch(
          `/api/analytics?type=overtime&locationId=${selectedLocation}&week=${currentWeek.toISOString()}`
        )
        const otData = await otR.json()
        setOvertimeWarnings(otData.staffAtRisk || [])
      }
    } catch {
      toast('Failed to load schedule', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation, currentWeek, role])

  useEffect(() => { loadShifts() }, [loadShifts])

  useSSE((event: SSEEvent) => {
    if (event.type === 'SHIFT_UPDATED' || event.type === 'ASSIGNMENT_CHANGED') {
      loadShifts()
    } else if (event.type === 'CONFLICT_ALERT') {
      const p = event.payload as any
      toast(`Conflict: ${p.message}${p.detail ? ` — ${p.detail}` : ''}`, 'error')
      loadShifts()
    }
  })

  const weekDays = getWeekDays(currentWeek)
  const todayStr = new Date().toISOString().split('T')[0]

  const getShiftsForDay = (day: Date) => {
    const dayStr = day.toISOString().split('T')[0]
    return shifts.filter((s) => s.startTime.split('T')[0] === dayStr)
  }

  const handlePublishWeek = async () => {
    if (!selectedLocation) return
    const draftShifts = shifts.filter((s) => s.status === 'DRAFT')
    if (draftShifts.length === 0) return toast('No draft shifts to publish', 'info')
    try {
      await Promise.all(
        draftShifts.map((s) =>
          fetch(`/api/shifts/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PUBLISHED' }),
          })
        )
      )
      toast(`Published ${draftShifts.length} shifts`, 'success')
      loadShifts()
    } catch {
      toast('Failed to publish shifts', 'error')
    }
  }

  const handleCreateShift = (dayDate: Date) => {
    window.location.href = `/shifts?create=1&date=${dayDate.toISOString().split('T')[0]}&locationId=${selectedLocation}`
  }

  const weekLabel = `${format(currentWeek, 'MMM d')} – ${format(new Date(currentWeek.getTime() + 6 * 24 * 3600000), 'MMM d, yyyy')}`

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Schedule" />

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 min-h-0">
        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Week navigator */}
          <div className="flex items-center gap-1 bg-white border rounded-xl shadow-sm px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentWeek((w) => { const n = new Date(w); n.setUTCDate(w.getUTCDate() - 7); return n })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium min-w-[160px] text-center">{weekLabel}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentWeek((w) => { const n = new Date(w); n.setUTCDate(w.getUTCDate() + 7); return n })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Location selector */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-52 bg-white shadow-sm">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Manager actions */}
          {role !== 'STAFF' && (
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white shadow-sm"
                onClick={handlePublishWeek}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Publish Week
              </Button>
              <Button
                size="sm"
                className="shadow-sm"
                onClick={() => window.location.href = `/shifts?create=1&locationId=${selectedLocation}`}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Shift
              </Button>
            </div>
          )}
        </div>

        {/* Overtime warning banner */}
        {overtimeWarnings.length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <div className="p-1 bg-amber-100 rounded-lg shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <span className="font-semibold text-amber-800">Overtime risk: </span>
              <span className="text-amber-700">
                {overtimeWarnings.map((w) => `${w.userName} (${w.weeklyHours.toFixed(1)}h)`).join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* Schedule grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading schedule…</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
            {weekDays.map((day, i) => {
              const dayShifts = getShiftsForDay(day)
              const isToday = day.toISOString().split('T')[0] === todayStr
              const isPast = day.toISOString().split('T')[0] < todayStr

              return (
                <div key={i} className="flex flex-col min-h-0">
                  {/* Day header */}
                  <div className="mb-2 text-center">
                    <div className={`inline-flex flex-col items-center px-2 py-1.5 rounded-xl w-full transition-colors ${isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{DAYS[i]}</span>
                      <span className={`text-[13px] font-bold leading-tight ${isToday ? 'text-white' : ''}`}>
                        {format(day, 'MMM d')}
                      </span>
                    </div>
                  </div>

                  {/* Shifts */}
                  <div className="flex flex-col gap-2 flex-1">
                    {dayShifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        isManager={role !== 'STAFF'}
                        currentUserId={userId}
                        onAssign={role !== 'STAFF' ? setAssignTarget : undefined}
                        onEdit={role !== 'STAFF' ? (s) => { window.location.href = `/shifts?edit=${s.id}` } : undefined}
                        onSwapRequest={role === 'STAFF' ? (s) => { window.location.href = `/swaps?request=${s.id}` } : undefined}
                      />
                    ))}

                    {/* Add button */}
                    {role !== 'STAFF' && (
                      <button
                        onClick={() => handleCreateShift(day)}
                        className="mt-auto w-full flex items-center justify-center gap-1 py-2 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all duration-150"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}

                    {dayShifts.length === 0 && role === 'STAFF' && (
                      <div className="flex items-center justify-center py-6 border border-dashed border-slate-200 rounded-xl">
                        <span className="text-[11px] text-slate-300">No shifts</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <AssignDialog
        shift={assignTarget}
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={loadShifts}
      />
    </div>
  )
}
