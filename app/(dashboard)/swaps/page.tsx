'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useSSE } from '@/hooks/useSSE'
import { ArrowLeftRight, Trash2, CheckCircle, XCircle, Clock, AlertCircle, PackagePlus } from 'lucide-react'
import { formatInTimezone } from '@/lib/timezone'

interface SwapRow {
  id: string; type: string; status: string; reason?: string; managerNote?: string
  createdAt: string; expiresAt?: string
  shift: {
    id: string; startTime: string; endTime: string; isPremium: boolean
    location: { name: string; timezone: string }
    skill: { name: string }
  }
  requester: { id: string; name: string; email: string }
  target?: { id: string; name: string; email: string } | null
  approver?: { id: string; name: string } | null
}

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
  EXPIRED: 'secondary',
}

export default function SwapsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const role = session?.user?.role as string
  const userId = session?.user?.id as string

  const [swaps, setSwaps] = useState<SwapRow[]>([])
  const [openDrops, setOpenDrops] = useState<SwapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [claimLoading, setClaimLoading] = useState<string | null>(null)
  const [approveDialog, setApproveDialog] = useState<{ swap: SwapRow; action: 'approve' | 'reject' } | null>(null)
  const [managerNote, setManagerNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadSwaps = useCallback(async () => {
    setLoading(true)
    const [swapData, openData] = await Promise.all([
      fetch('/api/swaps').then((r) => r.json()),
      fetch('/api/swaps?open=1').then((r) => r.json()),
    ])
    setSwaps(Array.isArray(swapData) ? swapData : [])
    setOpenDrops(Array.isArray(openData) ? openData : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadSwaps() }, [loadSwaps])

  useSSE((event) => {
    if (event.type === 'SWAP_REQUEST' || event.type === 'ASSIGNMENT_CHANGED') loadSwaps()
  })

  const handleAction = async (swapId: string, action: string, note?: string) => {
    setActionLoading(true)
    try {
      const r = await fetch(`/api/swaps/${swapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const data = await r.json()
      if (!r.ok) return toast(data.error || 'Failed', 'error')
      toast(`Swap ${action}d`, 'success')
      setApproveDialog(null)
      setManagerNote('')
      loadSwaps()
    } catch {
      toast('Action failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClaim = async (swapId: string) => {
    setClaimLoading(swapId)
    try {
      const r = await fetch(`/api/swaps/${swapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim' }),
      })
      const data = await r.json()
      if (!r.ok) return toast(data.error || 'Failed to claim shift', 'error')
      toast('Shift claimed — awaiting manager approval', 'success')
      loadSwaps()
    } catch {
      toast('Claim failed', 'error')
    } finally {
      setClaimLoading(null)
    }
  }

  const pendingSwaps = swaps.filter((s) => ['PENDING', 'ACCEPTED'].includes(s.status))
  const mySwaps = swaps.filter((s) => s.requester.id === userId || s.target?.id === userId)
  const allSwaps = role !== 'STAFF' ? swaps : mySwaps

  const renderSwap = (swap: SwapRow) => {
    const isMyRequest = swap.requester.id === userId
    const isTarget = swap.target?.id === userId
    const canApprove = (role === 'MANAGER' || role === 'ADMIN') && ['PENDING', 'ACCEPTED'].includes(swap.status)
    const canAccept = isTarget && swap.status === 'PENDING' && swap.type === 'SWAP'
    const canCancel = isMyRequest && ['PENDING', 'ACCEPTED'].includes(swap.status)

    return (
      <Card key={swap.id} className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {swap.type === 'DROP' ? 'Drop Request' : 'Swap Request'}
                </span>
                <Badge variant={statusVariant[swap.status] || 'secondary'} className="text-xs">
                  {swap.status}
                </Badge>
                {swap.shift.isPremium && <Badge variant="warning" className="text-xs">Premium</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatInTimezone(swap.shift.startTime, swap.shift.location.timezone, 'EEE MMM d, h:mm a zzz')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {swap.shift.location.name} · {swap.shift.skill.name}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span><span className="font-medium">From:</span> {swap.requester.name}</span>
                {swap.target && <span><span className="font-medium">To:</span> {swap.target.name}</span>}
              </div>
              {swap.reason && (
                <p className="text-xs text-muted-foreground mt-1 italic">"{swap.reason}"</p>
              )}
              {swap.managerNote && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Manager note:</span> {swap.managerNote}
                </p>
              )}
              {swap.expiresAt && swap.status === 'PENDING' && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {formatInTimezone(swap.expiresAt, 'UTC', 'MMM d, h:mm a')}
                </p>
              )}
              {swap.status === 'ACCEPTED' && role !== 'STAFF' && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Both parties agreed — awaiting your approval
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {canApprove && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setApproveDialog({ swap, action: 'approve' })}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => setApproveDialog({ swap, action: 'reject' })}>
                    <XCircle className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </>
              )}
              {canAccept && (
                <Button size="sm" className="h-7 text-xs" onClick={() => handleAction(swap.id, 'accept')}>
                  Accept Swap
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAction(swap.id, 'cancel')}>
                  <Trash2 className="h-3 w-3 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Swaps & Coverage" />
      <main className="flex-1 p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <Tabs defaultValue={role !== 'STAFF' ? 'pending' : 'open'}>
            <TabsList className="mb-4">
              {role !== 'STAFF' && (
                <TabsTrigger value="pending">
                  Needs Action {pendingSwaps.length > 0 && `(${pendingSwaps.length})`}
                </TabsTrigger>
              )}
              {role === 'STAFF' && (
                <TabsTrigger value="open">
                  Open Shifts {openDrops.length > 0 && `(${openDrops.length})`}
                </TabsTrigger>
              )}
              <TabsTrigger value="mine">My Requests</TabsTrigger>
              {role !== 'STAFF' && <TabsTrigger value="all">All Requests</TabsTrigger>}
            </TabsList>

            {role !== 'STAFF' && (
              <TabsContent value="pending" className="space-y-3">
                {pendingSwaps.length === 0
                  ? <p className="text-center py-8 text-muted-foreground">No pending requests</p>
                  : pendingSwaps.map(renderSwap)}
              </TabsContent>
            )}

            {role === 'STAFF' && (
              <TabsContent value="open" className="space-y-3">
                {openDrops.length === 0 ? (
                  <div className="text-center py-12">
                    <PackagePlus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No open shifts available right now</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Shifts dropped by colleagues will appear here</p>
                  </div>
                ) : openDrops.map((drop) => (
                  <Card key={drop.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-indigo-400">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <PackagePlus className="h-4 w-4 text-indigo-500" />
                            <span className="font-medium text-sm">Open Shift</span>
                            {drop.shift.isPremium && <Badge variant="warning" className="text-xs">Premium</Badge>}
                          </div>
                          <p className="text-sm font-medium">
                            {formatInTimezone(drop.shift.startTime, drop.shift.location.timezone, 'EEE MMM d, h:mm a')}
                            {' – '}
                            {formatInTimezone(drop.shift.endTime, drop.shift.location.timezone, 'h:mm a zzz')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {drop.shift.location.name} · {drop.shift.skill.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Offered by {drop.requester.name}
                            {drop.reason && <span className="italic"> · "{drop.reason}"</span>}
                          </p>
                          {drop.expiresAt && (
                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Claim by {formatInTimezone(drop.expiresAt, 'UTC', 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleClaim(drop.id)}
                          disabled={claimLoading === drop.id}
                        >
                          {claimLoading === drop.id ? 'Claiming…' : 'Pick Up'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}

            <TabsContent value="mine" className="space-y-3">
              {mySwaps.length === 0
                ? <p className="text-center py-8 text-muted-foreground">No swap requests</p>
                : mySwaps.map(renderSwap)}
            </TabsContent>

            {role !== 'STAFF' && (
              <TabsContent value="all" className="space-y-3">
                {allSwaps.length === 0
                  ? <p className="text-center py-8 text-muted-foreground">No swap requests</p>
                  : allSwaps.map(renderSwap)}
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>

      <Dialog open={!!approveDialog} onOpenChange={(o) => { if (!o) setApproveDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{approveDialog?.action === 'approve' ? 'Approve Swap' : 'Reject Swap'}</DialogTitle>
            <DialogDescription>
              {approveDialog?.action === 'approve'
                ? 'This will execute the shift change immediately.'
                : 'The swap request will be declined.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              placeholder="Add a note for the staff member..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button
              variant={approveDialog?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() => approveDialog && handleAction(approveDialog.swap.id, approveDialog.action, managerNote)}
              disabled={actionLoading}
            >
              {approveDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
