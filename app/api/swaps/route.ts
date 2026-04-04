import { requireAuth, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { notifySwapRequest, notifyManagerSwapNeedsApproval } from '@/lib/notifications'
import { sseManager } from '@/lib/sse'
import { addHours } from 'date-fns'

const MAX_PENDING_REQUESTS = 3

export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const shiftId = searchParams.get('shiftId')

  const role = session!.user.role
  const userId = session!.user.id

  const open = searchParams.get('open') === '1'

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (shiftId) where.shiftId = shiftId

  // "Open shifts" mode: unclaimed DROP requests any qualified staff can pick up
  if (open) {
    where.type = 'DROP'
    where.status = 'PENDING'
    where.targetUserId = null
    where.requesterId = { not: userId }
    // Only show non-expired: expiresAt null or in the future
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
  } else if (role === 'STAFF') {
    where.OR = [{ requesterId: userId }, { targetUserId: userId }]
  } else if (role === 'MANAGER') {
    // Manager sees swaps for their locations
    const managed = await prisma.locationManager.findMany({
      where: { userId },
      select: { locationId: true },
    })
    where.shift = { locationId: { in: managed.map((m) => m.locationId) } }
  }
  // ADMIN sees everything

  const swaps = await prisma.swapRequest.findMany({
    where,
    include: {
      shift: { include: { location: true, skill: true } },
      requester: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(swaps)
}

export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { shiftId, targetUserId, type, reason } = body

  if (!shiftId || !type) return err('shiftId and type required')
  if (!['SWAP', 'DROP'].includes(type)) return err('type must be SWAP or DROP')
  if (type === 'SWAP' && !targetUserId) return err('targetUserId required for SWAP')

  const userId = session!.user.id

  // Check: user must be assigned to the shift
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { shiftId, userId, status: 'ACTIVE' },
  })
  if (!assignment) return err('You are not assigned to this shift')

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { location: true },
  })
  if (!shift) return err('Shift not found', 404)
  if (shift.status === 'CANCELLED') return err('Cannot request swap for cancelled shift')

  // Check pending request limit
  const pendingCount = await prisma.swapRequest.count({
    where: { requesterId: userId, status: { in: ['PENDING', 'ACCEPTED'] } },
  })
  if (pendingCount >= MAX_PENDING_REQUESTS) {
    return err(`You already have ${MAX_PENDING_REQUESTS} pending swap/drop requests (maximum)`)
  }

  // For SWAP: check target is qualified (has skill + location cert)
  if (type === 'SWAP' && targetUserId) {
    const targetHasSkill = await prisma.userSkill.findFirst({
      where: { userId: targetUserId, skillId: shift.skillId },
    })
    if (!targetHasSkill) return err('Target staff member does not have the required skill for this shift')

    const targetHasCert = await prisma.locationCertification.findFirst({
      where: { userId: targetUserId, locationId: shift.locationId },
    })
    if (!targetHasCert) return err('Target staff member is not certified for this location')
  }

  // Compute expiry for DROP requests (24h before shift)
  const expiresAt = type === 'DROP' ? addHours(shift.startTime, -24) : null

  const swapRequest = await prisma.swapRequest.create({
    data: {
      shiftId,
      requesterId: userId,
      targetUserId: type === 'SWAP' ? targetUserId : null,
      type,
      reason,
      expiresAt,
      status: 'PENDING',
    },
    include: {
      shift: { include: { location: true, skill: true } },
      requester: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  })

  await createAuditLog({
    actorId: userId,
    action: type === 'SWAP' ? 'SWAP_REQUESTED' : 'DROP_REQUESTED',
    entityType: 'SWAP',
    entityId: swapRequest.id,
    shiftId,
    after: swapRequest,
  })

  // Notify target (for SWAP) or managers (for DROP)
  if (type === 'SWAP' && targetUserId) {
    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await notifySwapRequest(targetUserId, requester?.name || 'A colleague', shiftId, swapRequest.id)
    sseManager.sendToUser(targetUserId, {
      type: 'SWAP_REQUEST',
      payload: { swapRequestId: swapRequest.id, type: 'SWAP' },
      timestamp: new Date().toISOString(),
    })
  } else if (type === 'DROP') {
    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await notifyManagerSwapNeedsApproval(shift.locationId, requester?.name || 'Staff', swapRequest.id, 'DROP')
  }

  return ok(swapRequest, 201)
}
