'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Plus, Edit2, Trash2, Eye, EyeOff, Star } from 'lucide-react'
import { formatInTimezone } from '@/lib/timezone'

interface Location { id: string; name: string; timezone: string }
interface Skill { id: string; name: string; color: string }
interface ShiftRow {
  id: string; locationId: string; skillId: string; startTime: string; endTime: string
  headcount: number; isPremium: boolean; status: string; notes?: string
  location: Location; skill: Skill
  assignments: { id: string; userId: string; user: { name: string } }[]
}

const emptyForm = { locationId: '', skillId: '', date: '', startHour: '09', startMin: '00', endHour: '17', endMin: '00', headcount: '1', notes: '' }

export default function ShiftsPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLocation, setFilterLocation] = useState(searchParams.get('locationId') || 'all')
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('create') === '1')
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null)
  const [form, setForm] = useState({ ...emptyForm, date: searchParams.get('date') || '', locationId: searchParams.get('locationId') || '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/locations').then((r) => r.json()), fetch('/api/skills').then((r) => r.json())])
      .then(([locs, sks]) => { setLocations(locs); setSkills(sks) })
  }, [])

  const loadShifts = useCallback(async () => {
    setLoading(true)
    const qs = filterLocation && filterLocation !== 'all' ? `?locationId=${filterLocation}` : ''
    const data = await fetch(`/api/shifts${qs}`).then((r) => r.json())
    setShifts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterLocation])

  useEffect(() => { loadShifts() }, [loadShifts])

  const handleSubmit = async () => {
    if (!form.locationId || !form.skillId || !form.date) return toast('Fill in all required fields', 'error')
    const loc = locations.find((l) => l.id === form.locationId)
    if (!loc) return

    const startISO = `${form.date}T${form.startHour}:${form.startMin}:00`

    // For overnight shifts (end hour <= start hour), advance the end date by one day
    const startMinutes = parseInt(form.startHour) * 60 + parseInt(form.startMin)
    const endMinutes = parseInt(form.endHour) * 60 + parseInt(form.endMin)
    let endDate = form.date
    if (endMinutes <= startMinutes) {
      const next = new Date(form.date + 'T00:00:00')
      next.setDate(next.getDate() + 1)
      endDate = next.toISOString().split('T')[0]
    }
    const endISO = `${endDate}T${form.endHour}:${form.endMin}:00`

    // Convert local time to UTC using the location's timezone
    const { fromZonedTime } = await import('date-fns-tz')
    const startUtc = fromZonedTime(startISO, loc.timezone)
    const endUtc = fromZonedTime(endISO, loc.timezone)

    setSaving(true)
    try {
      const url = editingShift ? `/api/shifts/${editingShift.id}` : '/api/shifts'
      const method = editingShift ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: form.locationId,
          skillId: form.skillId,
          startTime: startUtc.toISOString(),
          endTime: endUtc.toISOString(),
          headcount: parseInt(form.headcount),
          notes: form.notes,
        }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'Failed')
      }
      toast(editingShift ? 'Shift updated' : 'Shift created', 'success')
      setDialogOpen(false)
      setEditingShift(null)
      setForm({ ...emptyForm })
      loadShifts()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Cancel this shift?')) return
    await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    toast('Shift cancelled', 'success')
    loadShifts()
  }

  const handlePublish = async (shift: ShiftRow) => {
    const newStatus = shift.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    await fetch(`/api/shifts/${shift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    toast(newStatus === 'PUBLISHED' ? 'Shift published' : 'Shift unpublished', 'success')
    loadShifts()
  }

  const openEdit = (shift: ShiftRow) => {
    const loc = locations.find((l) => l.id === shift.locationId)
    if (!loc) return
    const startLocal = new Date(shift.startTime)
    const endLocal = new Date(shift.endTime)
    setEditingShift(shift)
    setForm({
      locationId: shift.locationId,
      skillId: shift.skillId,
      date: formatInTimezone(startLocal, loc.timezone, 'yyyy-MM-dd'),
      startHour: formatInTimezone(startLocal, loc.timezone, 'HH'),
      startMin: formatInTimezone(startLocal, loc.timezone, 'mm'),
      endHour: formatInTimezone(endLocal, loc.timezone, 'HH'),
      endMin: formatInTimezone(endLocal, loc.timezone, 'mm'),
      headcount: shift.headcount.toString(),
      notes: shift.notes || '',
    })
    setDialogOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Manage Shifts" />
      <main className="flex-1 p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button onClick={() => { setEditingShift(null); setForm({ ...emptyForm }); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" /> New Shift
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading shifts...</div>
        ) : (
          <div className="space-y-2">
            {shifts.length === 0 && <p className="text-center py-12 text-muted-foreground">No shifts found</p>}
            {shifts.map((shift) => {
              const loc = shift.location
              const filled = shift.assignments.filter((a: any) => a.status !== 'CANCELLED').length
              return (
                <Card key={shift.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ backgroundColor: shift.skill.color }} className="h-3 w-3 rounded-full shrink-0" />
                          <span className="font-medium text-sm">{shift.skill.name}</span>
                          {shift.isPremium && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                          <Badge variant={shift.status === 'PUBLISHED' ? 'success' : 'secondary'} className="text-xs">
                            {shift.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatInTimezone(shift.startTime, loc.timezone, 'EEE MMM d, h:mm a')} –{' '}
                          {formatInTimezone(shift.endTime, loc.timezone, 'h:mm a zzz')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {loc.name} · {filled}/{shift.headcount} filled
                          {shift.assignments.length > 0 && ' · ' + shift.assignments.map((a: any) => a.user.name).join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handlePublish(shift)} title={shift.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}>
                          {shift.status === 'PUBLISHED' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(shift)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(shift.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingShift(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Create New Shift'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Location *</Label>
                <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Required Skill *</Label>
                <Select value={form.skillId} onValueChange={(v) => setForm((f) => ({ ...f, skillId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                  <SelectContent>{skills.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <div className="flex gap-1">
                  <Input className="w-16" maxLength={2} value={form.startHour} onChange={(e) => setForm((f) => ({ ...f, startHour: e.target.value }))} placeholder="09" />
                  <span className="self-center">:</span>
                  <Input className="w-16" maxLength={2} value={form.startMin} onChange={(e) => setForm((f) => ({ ...f, startMin: e.target.value }))} placeholder="00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <div className="flex gap-1">
                  <Input className="w-16" maxLength={2} value={form.endHour} onChange={(e) => setForm((f) => ({ ...f, endHour: e.target.value }))} placeholder="17" />
                  <span className="self-center">:</span>
                  <Input className="w-16" maxLength={2} value={form.endMin} onChange={(e) => setForm((f) => ({ ...f, endMin: e.target.value }))} placeholder="00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Headcount</Label>
                <Input type="number" min="1" max="20" value={form.headcount} onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
