'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, AlertTriangle, User } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { ShiftSummary } from '@/types'

interface AssignDialogProps {
  shift: ShiftSummary | null
  open: boolean
  onClose: () => void
  onAssigned: () => void
}

interface StaffOption { id: string; name: string; email: string }
interface ConstraintResult {
  blocked: boolean
  violations: { type: string; severity: string; message: string; detail?: string; suggestion?: string }[]
  warnings: { type: string; severity: string; message: string; detail?: string }[]
  suggestions?: StaffOption[]
}

export function AssignDialog({ shift, open, onClose, onAssigned }: AssignDialogProps) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [checkResult, setCheckResult] = useState<ConstraintResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (shift?.locationId) {
      fetch(`/api/users?locationId=${shift.locationId}&role=STAFF`)
        .then((r) => r.json())
        .then(setStaff)
    }
  }, [shift])

  useEffect(() => {
    setCheckResult(null)
    if (!selectedUserId || !shift) return

    setChecking(true)
    // Preview constraints by attempting assignment (the API will return violations without committing)
    fetch(`/api/shifts/${shift.id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.assignment) {
          // Assigned successfully — no hard blocks
          setCheckResult({ blocked: false, violations: [], warnings: data.warnings || [], suggestions: [] })
          toast('Staff member assigned successfully', 'success')
          onAssigned()
          onClose()
        } else if (data.blocked || (data.violations?.length > 0)) {
          setCheckResult(data)
        }
      })
      .catch(() => toast('Failed to check constraints', 'error'))
      .finally(() => setChecking(false))
  }, [selectedUserId])

  const handleForceAssign = async () => {
    if (!shift || !selectedUserId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/shifts/${shift.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, forceOverride: true, overrideReason: 'Manager override' }),
      })
      const data = await r.json()
      if (data.assignment) {
        toast('Assigned with override', 'warning')
        onAssigned()
        onClose()
      }
    } catch {
      toast('Failed to assign', 'error')
    } finally {
      setLoading(false)
    }
  }

  const hasErrors = checkResult?.violations?.some((v) => v.severity === 'ERROR')
  const hasWarnings = (checkResult?.warnings?.length || 0) > 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Staff to Shift</DialogTitle>
        </DialogHeader>

        {shift && (
          <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
            <p className="font-medium text-foreground">{shift.skillName} — {shift.locationName}</p>
            <p>{new Date(shift.startTime).toLocaleString()} – {new Date(shift.endTime).toLocaleString()}</p>
          </div>
        )}

        <div className="space-y-4">
          <Select onValueChange={setSelectedUserId} value={selectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member..." />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {checking && <p className="text-sm text-muted-foreground">Checking constraints...</p>}

          {checkResult && (
            <div className="space-y-2">
              {checkResult.violations?.map((v, i) => (
                <div key={i} className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">{v.message}</p>
                    {v.detail && <p className="text-red-600 text-xs mt-0.5">{v.detail}</p>}
                    {v.suggestion && <p className="text-red-500 text-xs mt-1 italic">{v.suggestion}</p>}
                  </div>
                </div>
              ))}
              {checkResult.warnings?.map((w, i) => (
                <div key={i} className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">{w.message}</p>
                    {w.detail && <p className="text-yellow-600 text-xs mt-0.5">{w.detail}</p>}
                  </div>
                </div>
              ))}
              {!hasErrors && !hasWarnings && (
                <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-green-800">All constraints satisfied</p>
                </div>
              )}
            </div>
          )}

          {checkResult?.suggestions && checkResult.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">SUGGESTED ALTERNATIVES</p>
              <div className="space-y-1">
                {checkResult.suggestions.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                    onClick={() => setSelectedUserId(s.id)}
                  >
                    <span className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {s.name}
                      <Badge variant="success" className="ml-auto">Available</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {hasErrors && (
            <Button variant="destructive" onClick={handleForceAssign} disabled={loading}>
              Force Assign (Override)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
