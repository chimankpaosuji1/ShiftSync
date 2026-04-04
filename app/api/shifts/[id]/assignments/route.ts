import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { checkAssignmentConstraints } from '@/lib/constraints'
import { createAuditLog } from '@/lib/audit'
import { notifyShiftAssigned, notifyOvertimeWarning } from '@/lib/notifications'
import { sseManager } from '@/lib/sse'
import { formatInTimezone } from '@/lib/timezone'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error
  const { id: shiftId } = await params

  const body = await req.json()
  const { userId, forceOverride, overrideReason } = body

  if (!userId) return err('userId required')

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { location: true },
  })
  if (!shift) return err('Shift not found', 404)
  if (shift.status === 'CANCELLED') return err('Cannot assign to a cancelled shift')

  // Manager scope check
  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId: shift.locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  // Check headcount
  const currentCount = await prisma.shiftAssignment.count({
    where: { shiftId, status: 'ACTIVE' },
  })
  if (currentCount >= shift.headcount) {
    return err(`Shift is already at full capacity (${shift.headcount} positions)`, 422)
  }

  // Already assigned?
  const alreadyAssigned = await prisma.shiftAssignment.findFirst({
    where: { shiftId, userId, status: 'ACTIVE' },
  })
  if (alreadyAssigned) return err('User already assigned to this shift')

  // Run constraint checks
  const checkResult = await checkAssignmentConstraints(userId, shiftId)

  if (!checkResult.allowed && !forceOverride) {
    // Push a CONFLICT_ALERT to the requesting manager in real-time so they see it immediately
    // without waiting for a page refresh — critical for simultaneous assignment race conditions
    const doubleBookViolation = checkResult.violations.find((v) => v.type === 'DOUBLE_BOOKING')
    if (doubleBookViolation) {
      sseManager.sendToUser(session!.user.id, {
        type: 'CONFLICT_ALERT',
        payload: {
          shiftId,
          userId,
          message: doubleBookViolation.message,
          detail: doubleBookViolation.detail,
        },
        timestamp: new Date().toISOString(),
      })
    }

    return ok(
      {
        blocked: true,
        violations: checkResult.violations,
        warnings: checkResult.warnings,
        suggestions: checkResult.suggestedAlternatives,
      },
      422
    )
  }

  // Create assignment
  const assignment = await prisma.shiftAssignment.create({
    data: {
      shiftId,
      userId,
      assignedBy: session!.user.id,
      status: 'ACTIVE',
    },
    include: { user: { select: { id: true, name: true, email: true } }, shift: { include: { location: true } } },
  })

  // Audit log — note if overridden
  await createAuditLog({
    actorId: session!.user.id,
    action: 'ASSIGNMENT_ADDED',
    entityType: 'ASSIGNMENT',
    entityId: assignment.id,
    shiftId,
    after: { userId, shiftId, forceOverride, overrideReason },
    note: forceOverride ? `Override: ${overrideReason || 'no reason given'}` : undefined,
  })

  // Notify staff member of assignment
  const shiftTimeStr = formatInTimezone(shift.startTime, shift.location.timezone, 'EEE MMM d, h:mm a zzz')
  await notifyShiftAssigned(userId, shiftId, shift.location.name, shiftTimeStr)

  // Notify managers if this assignment creates an overtime situation
  const overtimeWarning = checkResult.warnings.find((w) => w.type === 'OVERTIME_WARNING' && w.message.includes('exceed 40'))
  if (overtimeWarning) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const hoursMatch = overtimeWarning.message.match(/(\d+\.?\d*)h/)
    const projectedHours = hoursMatch ? parseFloat(hoursMatch[1]) : 40
    await notifyOvertimeWarning(shift.locationId, user?.name ?? 'Staff', projectedHours, shiftId)
  }

  // Broadcast real-time
  sseManager.broadcast(
    {
      type: 'ASSIGNMENT_CHANGED',
      payload: { shiftId, assignment, warnings: checkResult.warnings },
      timestamp: new Date().toISOString(),
    },
    [userId, session!.user.id]
  )

  return ok({
    assignment,
    warnings: checkResult.warnings,
    violations: checkResult.violations,
  }, 201)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error
  const { id: shiftId } = await params

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignmentId')
  if (!assignmentId) return err('assignmentId required')

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: { shift: true },
  })
  if (!assignment) return err('Assignment not found', 404)
  if (assignment.shiftId !== shiftId) return err('Assignment does not belong to this shift')

  const before = { ...assignment }
  await prisma.shiftAssignment.update({ where: { id: assignmentId }, data: { status: 'CANCELLED' } })

  await createAuditLog({
    actorId: session!.user.id,
    action: 'ASSIGNMENT_REMOVED',
    entityType: 'ASSIGNMENT',
    entityId: assignmentId,
    shiftId,
    before,
  })

  sseManager.sendToUser(assignment.userId, {
    type: 'ASSIGNMENT_CHANGED',
    payload: { shiftId, assignmentId, action: 'removed' },
    timestamp: new Date().toISOString(),
  })

  return ok({ success: true })
}
