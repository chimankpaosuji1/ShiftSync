import { requireAuth, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { notifySwapResolved, notifyManagerSwapNeedsApproval, createNotification } from '@/lib/notifications'
import { sseManager } from '@/lib/sse'
import { checkAssignmentConstraints } from '@/lib/constraints'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params

  const swap = await prisma.swapRequest.findUnique({
    where: { id },
    include: {
      shift: { include: { location: true, skill: true, assignments: { include: { user: { select: { id: true, name: true } } } } } },
      requester: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true } },
    },
  })
  if (!swap) return err('Not found', 404)
  return ok(swap)
}

// PATCH handles: accept (by target), approve/reject (by manager), cancel (by requester)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params

  const body = await req.json()
  const { action, note } = body // action: 'accept' | 'approve' | 'reject' | 'cancel'

  const swap = await prisma.swapRequest.findUnique({
    where: { id },
    include: {
      shift: { include: { location: true } },
      requester: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  })
  if (!swap) return err('Not found', 404)
  // Auto-expire drop requests past their expiry
  if (swap.status === 'PENDING' && swap.expiresAt && new Date(swap.expiresAt) < new Date()) {
    await prisma.swapRequest.update({ where: { id }, data: { status: 'EXPIRED' } })
    return err('This drop request has expired (shift starts in less than 24 hours)')
  }

  if (['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(swap.status)) {
    return err(`Swap request is already ${swap.status.toLowerCase()}`)
  }

  const userId = session!.user.id
  const role = session!.user.role

  if (action === 'accept') {
    // Target staff accepts the swap
    if (swap.targetUserId !== userId) return err('Only the target staff member can accept')
    if (swap.status !== 'PENDING') return err('Swap is not pending acceptance')

    // Check constraints for the target taking the requester's shift
    const check = await checkAssignmentConstraints(userId, swap.shiftId)
    if (!check.allowed) {
      return ok({ blocked: true, violations: check.violations, warnings: check.warnings }, 422)
    }

    await prisma.swapRequest.update({ where: { id }, data: { status: 'ACCEPTED' } })
    await createAuditLog({ actorId: userId, action: 'SWAP_ACCEPTED', entityType: 'SWAP', entityId: id, shiftId: swap.shiftId })

    // Notify requester and managers
    await createNotification(swap.requesterId, 'SWAP_ACCEPTED', 'Swap Accepted', `${swap.target?.name} accepted your swap request — awaiting manager approval`, { swapId: id })
    const requesterName = `${swap.requester.name} & ${swap.target?.name}`
    await notifyManagerSwapNeedsApproval(swap.shift.locationId, requesterName, id, 'SWAP')

    sseManager.sendToUser(swap.requesterId, {
      type: 'SWAP_REQUEST',
      payload: { swapRequestId: id, action: 'accepted' },
      timestamp: new Date().toISOString(),
    })

    return ok({ success: true, status: 'ACCEPTED' })
  }

  if (action === 'approve') {
    if (!['MANAGER', 'ADMIN'].includes(role)) return err('Only managers can approve swaps')
    if (!['PENDING', 'ACCEPTED'].includes(swap.status)) return err('Swap cannot be approved in current state')

    // For SWAP: need acceptance from target first
    if (swap.type === 'SWAP' && swap.status !== 'ACCEPTED') {
      return err('Swap must be accepted by the target staff member before manager approval')
    }

    // Validate manager scope
    if (role === 'MANAGER') {
      const manages = await prisma.locationManager.findUnique({
        where: { userId_locationId: { userId, locationId: swap.shift.locationId } },
      })
      if (!manages) return err('Forbidden', 403)
    }

    // Execute the swap/drop
    await prisma.$transaction(async (tx) => {
      await tx.swapRequest.update({
        where: { id },
        data: { status: 'APPROVED', approverId: userId, managerNote: note },
      })

      // Update shift assignments
      const requesterAssignment = await tx.shiftAssignment.findFirst({
        where: { shiftId: swap.shiftId, userId: swap.requesterId, status: 'ACTIVE' },
      })

      if (swap.type === 'DROP') {
        // Remove requester, shift becomes open
        if (requesterAssignment) {
          await tx.shiftAssignment.update({ where: { id: requesterAssignment.id }, data: { status: 'DROPPED' } })
        }
      } else if (swap.type === 'SWAP' && swap.targetUserId) {
        // Remove requester, add target
        if (requesterAssignment) {
          await tx.shiftAssignment.update({ where: { id: requesterAssignment.id }, data: { status: 'SWAPPED' } })
        }
        await tx.shiftAssignment.create({
          data: {
            shiftId: swap.shiftId,
            userId: swap.targetUserId,
            assignedBy: userId,
            status: 'ACTIVE',
          },
        })
      }
    })

    await createAuditLog({
      actorId: userId,
      action: 'SWAP_APPROVED',
      entityType: 'SWAP',
      entityId: id,
      shiftId: swap.shiftId,
      note,
    })

    await notifySwapResolved(swap.requesterId, 'APPROVED', id, note)
    if (swap.targetUserId) await notifySwapResolved(swap.targetUserId, 'APPROVED', id, note)

    sseManager.broadcast(
      { type: 'ASSIGNMENT_CHANGED', payload: { shiftId: swap.shiftId, swapApproved: true }, timestamp: new Date().toISOString() },
      [swap.requesterId, ...(swap.targetUserId ? [swap.targetUserId] : [])]
    )

    return ok({ success: true, status: 'APPROVED' })
  }

  if (action === 'reject') {
    if (!['MANAGER', 'ADMIN'].includes(role)) return err('Only managers can reject swaps')

    if (role === 'MANAGER') {
      const manages = await prisma.locationManager.findUnique({
        where: { userId_locationId: { userId, locationId: swap.shift.locationId } },
      })
      if (!manages) return err('Forbidden', 403)
    }

    await prisma.swapRequest.update({
      where: { id },
      data: { status: 'REJECTED', approverId: userId, managerNote: note },
    })

    await createAuditLog({ actorId: userId, action: 'SWAP_REJECTED', entityType: 'SWAP', entityId: id, shiftId: swap.shiftId, note })
    await notifySwapResolved(swap.requesterId, 'REJECTED', id, note)
    if (swap.targetUserId) await notifySwapResolved(swap.targetUserId, 'REJECTED', id, note)

    return ok({ success: true, status: 'REJECTED' })
  }

  if (action === 'claim') {
    // A qualified staff member picks up an open DROP request
    if (swap.type !== 'DROP') return err('Only drop requests can be claimed')
    if (swap.status !== 'PENDING') return err('This drop request is no longer available')
    if (swap.requesterId === userId) return err('You cannot claim your own drop request')

    // Claimant must have the skill and location cert
    const [hasSkill, hasCert] = await Promise.all([
      prisma.userSkill.findFirst({ where: { userId, skillId: swap.shift.skillId } }),
      prisma.locationCertification.findFirst({ where: { userId, locationId: swap.shift.locationId } }),
    ])
    if (!hasSkill) return err('You do not have the required skill for this shift')
    if (!hasCert) return err('You are not certified for this location')

    // Run full constraint check for the claimant
    const check = await checkAssignmentConstraints(userId, swap.shiftId)
    if (!check.allowed) {
      return ok({ blocked: true, violations: check.violations, warnings: check.warnings }, 422)
    }

    // Set the claimant as the target and move to ACCEPTED so manager can approve
    await prisma.swapRequest.update({
      where: { id },
      data: { targetUserId: userId, status: 'ACCEPTED' },
    })

    await createAuditLog({ actorId: userId, action: 'SWAP_ACCEPTED', entityType: 'SWAP', entityId: id, shiftId: swap.shiftId })

    const claimant = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await createNotification(swap.requesterId, 'DROP_CLAIMED', 'Drop Request Claimed', `${claimant?.name} picked up your shift — awaiting manager approval`, { swapId: id })
    await notifyManagerSwapNeedsApproval(swap.shift.locationId, claimant?.name ?? 'Staff', id, 'DROP')

    sseManager.sendToUser(swap.requesterId, {
      type: 'SWAP_REQUEST',
      payload: { swapRequestId: id, action: 'claimed' },
      timestamp: new Date().toISOString(),
    })

    return ok({ success: true, status: 'ACCEPTED' })
  }

  if (action === 'cancel') {
    // Requester can cancel their own pending/accepted request
    if (swap.requesterId !== userId && !['MANAGER', 'ADMIN'].includes(role)) {
      return err('Only the requester or a manager can cancel')
    }
    if (!['PENDING', 'ACCEPTED'].includes(swap.status)) return err('Cannot cancel in current state')

    await prisma.swapRequest.update({ where: { id }, data: { status: 'CANCELLED' } })
    await createAuditLog({ actorId: userId, action: 'SWAP_CANCELLED', entityType: 'SWAP', entityId: id, shiftId: swap.shiftId })

    if (swap.targetUserId && swap.targetUserId !== userId) {
      await notifySwapResolved(swap.targetUserId, 'CANCELLED', id)
    }

    return ok({ success: true, status: 'CANCELLED' })
  }

  return err('Unknown action')
}
