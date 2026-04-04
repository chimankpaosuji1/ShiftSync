'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Clock, MapPin, Bell, Mail } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [availability, setAvailability] = useState<any[]>([])
  const [editName, setEditName] = useState('')
  const [editDesiredHours, setEditDesiredHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({ inApp: true, email: false })
  const [savingPrefs, setSavingPrefs] = useState(false)

  // New availability form
  const [newAvail, setNewAvail] = useState({
    type: 'RECURRING',
    dayOfWeek: '1',
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    note: '',
  })

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((data) => {
      setProfile(data)
      setEditName(data.name || '')
      setEditDesiredHours(data.desiredHours?.toString() || '40')
      if (data.notificationPrefs) {
        setNotifPrefs({ inApp: data.notificationPrefs.inApp ?? true, email: data.notificationPrefs.email ?? false })
      }
    })
    fetch('/api/availability').then((r) => r.json()).then(setAvailability)
  }, [])

  const saveNotifPrefs = async () => {
    setSavingPrefs(true)
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPrefs: notifPrefs }),
      })
      if (!r.ok) throw new Error()
      toast('Notification preferences saved', 'success')
    } catch {
      toast('Failed to save preferences', 'error')
    } finally {
      setSavingPrefs(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, desiredHours: parseInt(editDesiredHours) }),
      })
      toast('Profile updated', 'success')
    } catch {
      toast('Failed to update', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addAvailability = async () => {
    try {
      const body = {
        type: newAvail.type,
        dayOfWeek: newAvail.type === 'RECURRING' ? parseInt(newAvail.dayOfWeek) : undefined,
        date: newAvail.type === 'EXCEPTION' ? newAvail.date : undefined,
        startTime: newAvail.startTime,
        endTime: newAvail.endTime,
        isAvailable: newAvail.isAvailable,
        note: newAvail.note,
      }
      const r = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) return toast(data.error || 'Failed', 'error')
      setAvailability((prev) => [...prev, data])
      toast('Availability added', 'success')
    } catch {
      toast('Failed to add availability', 'error')
    }
  }

  const deleteAvailability = async (id: string) => {
    await fetch(`/api/availability?id=${id}`, { method: 'DELETE' })
    setAvailability((prev) => prev.filter((a) => a.id !== id))
    toast('Availability removed', 'success')
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="My Profile" />
      <main className="flex-1 p-4 lg:p-6 max-w-2xl">
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={profile?.email || ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Desired Weekly Hours</Label>
                  <Input type="number" min="0" max="60" value={editDesiredHours} onChange={(e) => setEditDesiredHours(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for fairness calculations and scheduling preferences</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input value={profile?.role || ''} disabled className="bg-muted capitalize" />
                </div>
                <Button onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </CardContent>
            </Card>

            {profile?.skills?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">My Skills</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((s: any) => (
                      <span
                        key={s.skill.id}
                        className="px-3 py-1 rounded-full text-sm text-white"
                        style={{ backgroundColor: s.skill.color }}
                      >
                        {s.skill.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {profile?.certifications?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Certified Locations</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.certifications.map((c: any) => (
                      <Badge key={c.location.id} variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />{c.location.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="availability" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Add Availability Window</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Type</Label>
                    <Select value={newAvail.type} onValueChange={(v) => setNewAvail((a) => ({ ...a, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RECURRING">Recurring (weekly)</SelectItem>
                        <SelectItem value="EXCEPTION">One-off exception</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newAvail.type === 'RECURRING' ? (
                    <div className="space-y-1.5 col-span-2">
                      <Label>Day of Week</Label>
                      <Select value={newAvail.dayOfWeek} onValueChange={(v) => setNewAvail((a) => ({ ...a, dayOfWeek: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5 col-span-2">
                      <Label>Date</Label>
                      <Input type="date" value={newAvail.date} onChange={(e) => setNewAvail((a) => ({ ...a, date: e.target.value }))} />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Start Time</Label>
                    <Input type="time" value={newAvail.startTime} onChange={(e) => setNewAvail((a) => ({ ...a, startTime: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Time</Label>
                    <Input type="time" value={newAvail.endTime} onChange={(e) => setNewAvail((a) => ({ ...a, endTime: e.target.value }))} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={newAvail.isAvailable.toString()} onValueChange={(v) => setNewAvail((a) => ({ ...a, isAvailable: v === 'true' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Available</SelectItem>
                        <SelectItem value="false">Unavailable (block)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input value={newAvail.note} onChange={(e) => setNewAvail((a) => ({ ...a, note: e.target.value }))} placeholder="e.g., Doctor's appointment" />
                  </div>
                </div>
                <Button onClick={addAvailability}>
                  <Plus className="h-4 w-4 mr-2" /> Add Availability
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">My Availability Windows</CardTitle></CardHeader>
              <CardContent>
                {availability.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No availability set — you'll need to add windows for scheduling</p>
                ) : (
                  <div className="space-y-2">
                    {availability.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant={a.isAvailable ? 'success' : 'destructive'} className="text-xs">
                              {a.isAvailable ? 'Available' : 'Blocked'}
                            </Badge>
                            <span className="font-medium">
                              {a.type === 'RECURRING' ? DAYS[a.dayOfWeek] : `${a.date} (one-off)`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {a.startTime} – {a.endTime}
                            {a.note && ` · ${a.note}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAvailability(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose how you want to receive notifications.</p>

                {/* In-app */}
                <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
                  <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                    <Bell className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">In-app notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shown in the notification bell and notification center. Always recommended.
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifPrefs((p) => ({ ...p, inApp: !p.inApp }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${notifPrefs.inApp ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    role="switch"
                    aria-checked={notifPrefs.inApp}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifPrefs.inApp ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Email simulation */}
                <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
                  <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                    <Mail className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Email notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Simulated — logged to the audit trail. No actual emails are sent in this demo.
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifPrefs((p) => ({ ...p, email: !p.email }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${notifPrefs.email ? 'bg-emerald-600' : 'bg-slate-200'}`}
                    role="switch"
                    aria-checked={notifPrefs.email}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifPrefs.email ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-3">You will be notified for:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {[
                      'New shifts assigned to you',
                      'Changes to your scheduled shifts',
                      'Schedule published for your location',
                      'Swap & drop request updates',
                      'Overtime warnings (managers)',
                      'Staff availability changes (managers)',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-indigo-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button onClick={saveNotifPrefs} disabled={savingPrefs}>
                  {savingPrefs ? 'Saving…' : 'Save Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
