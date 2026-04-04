'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Plus, MapPin, Clock, Users, Pencil, PowerOff, Power, Trash2 } from 'lucide-react'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET) — New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) — Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) — Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska Time — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time — Honolulu' },
]

interface LocationRow {
  id: string
  name: string
  address: string
  city: string
  state: string
  timezone: string
  isActive: boolean
  createdAt: string
  _count: { shifts: number; certifications: number }
}

const emptyForm = { name: '', address: '', city: '', state: '', timezone: 'America/New_York' }

export default function LocationsPage() {
  const { toast } = useToast()
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch('/api/locations').then((r) => r.json())
      setLocations(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLocations() }, [loadLocations])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setDialogOpen(true)
  }

  const openEdit = (loc: LocationRow) => {
    setEditingId(loc.id)
    setForm({ name: loc.name, address: loc.address, city: loc.city, state: loc.state, timezone: loc.timezone })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.timezone) return toast('Name and timezone are required', 'error')
    setSaving(true)
    try {
      const url = editingId ? `/api/locations/${editingId}` : '/api/locations'
      const method = editingId ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) return toast(data.error || 'Failed to save', 'error')
      toast(editingId ? 'Location updated' : 'Location created', 'success')
      setDialogOpen(false)
      loadLocations()
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (loc: LocationRow) => {
    const r = await fetch(`/api/locations/${loc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !loc.isActive }),
    })
    if (!r.ok) return toast('Failed to update', 'error')
    toast(loc.isActive ? 'Location deactivated' : 'Location activated', 'success')
    loadLocations()
  }

  const handleDelete = async (id: string) => {
    const r = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    const data = await r.json()
    if (!r.ok) return toast(data.error || 'Cannot delete', 'error')
    toast('Location deleted', 'success')
    setDeleteConfirmId(null)
    loadLocations()
  }

  const tzLabel = (tz: string) => TIMEZONES.find((t) => t.value === tz)?.label.split(' — ')[0] ?? tz

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Locations" />
      <main className="flex-1 p-4 lg:p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Locations</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage Coastal Eats restaurant locations
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Location
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Locations', value: locations.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Active', value: locations.filter((l) => l.isActive).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Inactive', value: locations.filter((l) => !l.isActive).length, color: 'text-slate-500', bg: 'bg-slate-100' },
          ].map(({ label, value, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Location list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No locations yet</p>
            <p className="text-sm mt-1">Add your first restaurant location to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {locations.map((loc) => (
              <Card key={loc.id} className={`transition-opacity ${!loc.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${loc.isActive ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                    <MapPin className={`h-5 w-5 ${loc.isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{loc.name}</span>
                      <Badge variant={loc.isActive ? 'success' : 'secondary'} className="text-[10px]">
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      {(loc.address || loc.city) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tzLabel(loc.timezone)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {loc._count.certifications} certified staff
                      </span>
                      <span>{loc._count.shifts} shifts</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Edit"
                      onClick={() => openEdit(loc)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 w-8 p-0 ${loc.isActive ? 'text-muted-foreground hover:text-amber-600' : 'text-muted-foreground hover:text-emerald-600'}`}
                      title={loc.isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => handleToggleActive(loc)}
                    >
                      {loc.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteConfirmId(loc.id)}
                      disabled={loc._count.shifts > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the location details below.' : 'Fill in the details for the new restaurant location.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Harbor View Bistro"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Timezone <span className="text-destructive">*</span></Label>
              <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Harbor Dr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Boston"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="MA"
                  maxLength={2}
                  className="uppercase"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The location and all its data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
