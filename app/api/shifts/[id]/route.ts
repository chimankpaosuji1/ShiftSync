import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { isPremiumShift } from '@/lib/timezone'
import { checkEditCutoff } from '@/lib/constraints'
import { createAuditLog } from '@/lib/audit'
import { sseManager } from '@/lib/sse'
import { notifySchedulePublished, notifyShiftChanged } from '@/lib/notifications'
import { format } from 'date-fns'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      location: true,
      skill: true,
      assignments: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
      swapRequests: {
        where: { status: { in: ['PENDING', 'ACCEPTED'] } },
        include: {
          requester: { select: { id: true, name: true } },
          target: { select: { id: true, name: true } },
        },
      },
      auditLogs: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!shift) return err('Not found', 404)

  // Scope check for managers
  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId: shift.locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  return ok(shift)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error
  const { id } = await params

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { location: true },
  })
  if (!shift) return err('Not found', 404)

  // Scope check
  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId: shift.locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  const body = await req.json()
  const { startTime, endTime, headcount, notes, status, skillId, forceEdit } = body

  // Edit cutoff check for published shifts — skip when only toggling status (publish/unpublish)
  const isStatusOnlyChange = status && !startTime && !endTime && !headcount && !notes && !skillId
  if (shift.status === 'PUBLISHED' && !forceEdit && !isStatusOnlyChange) {
    const violation = checkEditCutoff(shift)
    if (violation) return err(violation.message, 422)
  }

  const before = { ...shift }
  const updateData: Record<string, unknown> = {}
  if (startTime) updateData.startTime = new Date(startTime)
  if (endTime) updateData.endTime = new Date(endTime)
  if (headcount) updateData.headcount = Number(headcount)
  if (notes !== undefined) updateData.notes = notes
  if (skillId) updateData.skillId = skillId

  // Recalculate premium status if times changed
  if (startTime) {
    updateData.isPremium = isPremiumShift(new Date(startTime), shift.location.timezone)
  }

  // Handle publish/unpublish
  if (status === 'PUBLISHED' && shift.status !== 'PUBLISHED') {
    updateData.status = 'PUBLISHED'
    updateData.publishedAt = new Date()
    updateData.publishedBy = session!.user.id
  } else if (status === 'DRAFT' && shift.status === 'PUBLISHED') {
    updateData.status = 'DRAFT'
    updateData.publishedAt = null
  } else if (status) {
    updateData.status = status
  }

  const updated = await prisma.shift.update({
    where: { id },
    data: updateData,
    include: { location: true, skill: true, assignments: { include: { user: { select: { id: true, name: true } } } } },
  })

  await createAuditLog({
    actorId: session!.user.id,
    action: status === 'PUBLISHED' ? 'SHIFT_PUBLISHED' : 'SHIFT_UPDATED',
    entityType: 'SHIFT',
    entityId: id,
    shiftId: id,
    before,
    after: updated,
  })

  const assignedUserIds = updated.assignments.map((a) => a.userId)
  const shiftTimeStr = format(updated.startTime, 'EEE MMM d, h:mm a')

  if (status === 'PUBLISHED' && assignedUserIds.length) {
    // Notify all assigned staff that the schedule is published
    const weekOf = format(updated.startTime, 'MMM d, yyyy')
    await notifySchedulePublished(assignedUserIds, updated.location.name, weekOf)
  } else if (assignedUserIds.length && Object.keys(updateData).some((k) => ['startTime', 'endTime', 'skillId', 'headcount'].includes(k))) {
    // Notify assigned staff that their shift details changed
    const changes: string[] = []
    if (updateData.startTime || updateData.endTime) changes.push('time changed')
    if (updateData.skillId) changes.push('role changed')
    if (updateData.headcount) changes.push('headcount changed')
    await notifyShiftChanged(assignedUserIds, shift.id, updated.location.name, shiftTimeStr, changes.join(', '))
  }

  // Cancel pending swap requests if shift was edited
  if (Object.keys(updateData).some((k) => ['startTime', 'endTime', 'skillId'].includes(k))) {
    const pendingSwaps = await prisma.swapRequest.findMany({
      where: { shiftId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
      include: { requester: true, target: true },
    })
    for (const swap of pendingSwaps) {
      await prisma.swapRequest.update({ where: { id: swap.id }, data: { status: 'CANCELLED', managerNote: 'Shift was edited' } })
      // Notify affected parties
      const { createNotification } = await import('@/lib/notifications')
      await createNotification(swap.requesterId, 'SWAP_CANCELLED', 'Swap Request Cancelled', 'The shift was edited, cancelling your pending swap request', { swapId: swap.id })
      if (swap.targetUserId) {
        await createNotification(swap.targetUserId, 'SWAP_CANCELLED', 'Swap Request Cancelled', 'The shift was edited, cancelling a pending swap request', { swapId: swap.id })
      }
    }
  }

  // Broadcast real-time update
  sseManager.broadcast(
    { type: 'SHIFT_UPDATED', payload: { shiftId: id, shift: updated }, timestamp: new Date().toISOString() },
    assignedUserIds
  )

  return ok(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error
  const { id } = await params

  const shift = await prisma.shift.findUnique({ where: { id } })
  if (!shift) return err('Not found', 404)

  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId: shift.locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  await prisma.shift.update({ where: { id }, data: { status: 'CANCELLED' } })
  await createAuditLog({
    actorId: session!.user.id,
    action: 'SHIFT_CANCELLED',
    entityType: 'SHIFT',
    entityId: id,
    shiftId: id,
    before: shift,
  })

  return ok({ success: true })
}
