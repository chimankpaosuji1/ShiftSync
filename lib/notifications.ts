import { prisma } from './db'

export type NotificationType =
  | 'SHIFT_ASSIGNED'
  | 'SHIFT_CHANGED'
  | 'SHIFT_CANCELLED'
  | 'SCHEDULE_PUBLISHED'
  | 'SWAP_REQUEST_RECEIVED'
  | 'SWAP_ACCEPTED'
  | 'SWAP_APPROVED'
  | 'SWAP_REJECTED'
  | 'SWAP_CANCELLED'
  | 'DROP_REQUEST'
  | 'DROP_CLAIMED'
  | 'OVERTIME_WARNING'
  | 'AVAILABILITY_CHANGED'
  | 'COVERAGE_NEEDED'

interface NotificationData {
  [key: string]: unknown
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: NotificationData
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
    },
  })

  try {
    const { sseManager } = await import('./sse')
    sseManager.sendToUser(userId, {
      type: 'NOTIFICATION',
      payload: {
        id: notification.id,
        type,
        title,
        body,
        data,
        createdAt: notification.createdAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    })
  } catch {
    // SSE not available in all contexts
  }

  return notification
}

// ── Staff: shift assigned ─────────────────────────────────────────────────────
export async function notifyShiftAssigned(
  staffId: string,
  shiftId: string,
  locationName: string,
  shiftTime: string
) {
  return createNotification(
    staffId,
    'SHIFT_ASSIGNED',
    'New Shift Assigned',
    `You've been assigned to a shift at ${locationName} on ${shiftTime}`,
    { shiftId }
  )
}

// ── Staff: shift details changed after assignment ─────────────────────────────
export async function notifyShiftChanged(
  staffIds: string[],
  shiftId: string,
  locationName: string,
  shiftTime: string,
  changeDescription: string
) {
  return Promise.all(
    staffIds.map((id) =>
      createNotification(
        id,
        'SHIFT_CHANGED',
        'Your Shift Was Updated',
        `A shift at ${locationName} on ${shiftTime} has been changed: ${changeDescription}`,
        { shiftId }
      )
    )
  )
}

// ── Staff: schedule published ─────────────────────────────────────────────────
export async function notifySchedulePublished(
  staffIds: string[],
  locationName: string,
  weekOf: string
) {
  return Promise.all(
    staffIds.map((id) =>
      createNotification(
        id,
        'SCHEDULE_PUBLISHED',
        'Schedule Published',
        `The schedule for ${locationName} — week of ${weekOf} is now available`,
        { locationName, weekOf }
      )
    )
  )
}

// ── Staff: swap request received ──────────────────────────────────────────────
export async function notifySwapRequest(
  targetUserId: string,
  requesterName: string,
  shiftId: string,
  swapRequestId: string
) {
  return createNotification(
    targetUserId,
    'SWAP_REQUEST_RECEIVED',
    'Shift Swap Request',
    `${requesterName} wants to swap a shift with you`,
    { swapRequestId, shiftId }
  )
}

// ── Managers: swap/drop needs approval ───────────────────────────────────────
export async function notifyManagerSwapNeedsApproval(
  locationId: string,
  requesterName: string,
  swapRequestId: string,
  type: 'SWAP' | 'DROP'
) {
  const managers = await prisma.locationManager.findMany({
    where: { locationId },
    include: { user: true },
  })

  return Promise.all(
    managers.map((m) =>
      createNotification(
        m.userId,
        type === 'DROP' ? 'DROP_REQUEST' : 'SWAP_REQUEST_RECEIVED',
        type === 'DROP' ? 'Drop Request Needs Approval' : 'Swap Request Needs Approval',
        `${requesterName} has submitted a ${type.toLowerCase()} request requiring your approval`,
        { swapRequestId }
      )
    )
  )
}

// ── Staff: swap resolved ──────────────────────────────────────────────────────
export async function notifySwapResolved(
  userId: string,
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
  swapRequestId: string,
  note?: string
) {
  const messages: Record<string, { title: string; body: string }> = {
    APPROVED: { title: 'Swap Approved', body: `Your shift swap/drop request has been approved${note ? `: ${note}` : ''}` },
    REJECTED: { title: 'Swap Rejected', body: `Your shift swap/drop request was rejected${note ? `: ${note}` : ''}` },
    CANCELLED: { title: 'Swap Cancelled', body: `A shift swap/drop request was cancelled` },
  }
  const msg = messages[status]
  return createNotification(
    userId,
    status === 'APPROVED' ? 'SWAP_APPROVED' : status === 'REJECTED' ? 'SWAP_REJECTED' : 'SWAP_CANCELLED',
    msg.title,
    msg.body,
    { swapRequestId }
  )
}

// ── Managers: overtime warning ────────────────────────────────────────────────
export async function notifyOvertimeWarning(
  managersLocationId: string,
  staffName: string,
  projectedHours: number,
  shiftId: string
) {
  const managers = await prisma.locationManager.findMany({
    where: { locationId: managersLocationId },
  })
  return Promise.all(
    managers.map((m) =>
      createNotification(
        m.userId,
        'OVERTIME_WARNING',
        'Overtime Warning',
        `${staffName} is projected at ${projectedHours.toFixed(1)}h this week — over the 40h threshold`,
        { shiftId, staffName, projectedHours }
      )
    )
  )
}

// ── Managers: staff availability changed ─────────────────────────────────────
export async function notifyAvailabilityChanged(
  staffId: string,
  staffName: string,
  changeDescription: string
) {
  // Notify all managers of locations where this staff member is certified
  const certs = await prisma.locationCertification.findMany({
    where: { userId: staffId },
    include: {
      location: {
        include: { managers: true },
      },
    },
  })

  const managerIds = new Set<string>()
  for (const cert of certs) {
    for (const mgr of cert.location.managers) {
      managerIds.add(mgr.userId)
    }
  }

  return Promise.all(
    [...managerIds].map((managerId) =>
      createNotification(
        managerId,
        'AVAILABILITY_CHANGED',
        'Staff Availability Updated',
        `${staffName} updated their availability: ${changeDescription}`,
        { staffId, staffName }
      )
    )
  )
}
