'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Search, Plus, Clock, MapPin } from 'lucide-react'

interface StaffMember {
  id: string; name: string; email: string; role: string; desiredHours: number; isActive: boolean
  skills: { skill: { id: string; name: string; color: string } }[]
  certifications: { location: { id: string; name: string } }[]
}

export default function StaffPage() {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('all')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF', desiredHours: '40', skills: [] as string[], certifications: [] as string[] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/locations').then((r) => r.json()),
      fetch('/api/skills').then((r) => r.json()),
    ]).then(([locs, sks]) => { setLocations(locs); setSkills(sks) })
  }, [])

  const loadStaff = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (filterLocation && filterLocation !== 'all') qs.set('locationId', filterLocation)
    const data = await fetch(`/api/users?${qs}`).then((r) => r.json())
    setStaff(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterLocation])

  useEffect(() => { loadStaff() }, [loadStaff])

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return toast('Name, email, and password required', 'error')
    setSaving(true)
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) return toast(data.error || 'Failed', 'error')
      toast('Staff member created', 'success')
      setDialogOpen(false)
      setForm({ name: '', email: '', password: '', role: 'STAFF', desiredHours: '40', skills: [], certifications: [] })
      loadStaff()
    } catch {
      toast('Failed to create staff member', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Staff Management" />
      <main className="flex-1 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Staff
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading staff...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((member) => (
              <Card key={member.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm">
                        {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{member.name}</p>
                        <Badge variant={member.role === 'ADMIN' ? 'default' : member.role === 'MANAGER' ? 'info' : 'secondary'} className="text-xs shrink-0">
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {member.desiredHours}h/week desired
                      </div>
                    </div>
                  </div>

                  {member.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {member.skills.map((s) => (
                        <span
                          key={s.skill.id}
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: s.skill.color }}
                        >
                          {s.skill.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {member.certifications.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {member.certifications.map((c) => (
                        <span key={c.location.id} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{c.location.name.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">No staff members found</div>
            )}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@coastaleats.com" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Desired Hours/Week</Label>
                <Input type="number" min="0" max="60" value={form.desiredHours} onChange={(e) => setForm((f) => ({ ...f, desiredHours: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      skills: f.skills.includes(s.id) ? f.skills.filter((id) => id !== s.id) : [...f.skills, s.id],
                    }))}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.skills.includes(s.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Certified Locations</Label>
              <div className="flex flex-wrap gap-2">
                {locations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      certifications: f.certifications.includes(l.id) ? f.certifications.filter((id) => id !== l.id) : [...f.certifications, l.id],
                    }))}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.certifications.includes(l.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Staff Member'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
