import { requireAuth, ok } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { shiftDurationHours } from '@/lib/timezone'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const role = session!.user.role
  const now = new Date()

  const weekStart = new Date(now)
  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - (day === 0 ? 6 : day - 1))
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  // On-duty NOW — scoped by role
  const onDuty = await prisma.shiftAssignment.findMany({
    where: {
      status: 'ACTIVE',
      shift: {
        status: 'PUBLISHED',
        startTime: { lte: now },
        endTime: { gte: now },
        ...(role === 'MANAGER' ? { location: { managers: { some: { userId } } } } : {}),
        ...(role === 'STAFF' ? { assignments: { some: { userId } } } : {}),
      },
    },
    include: {
      user: { select: { id: true, name: true } },
      shift: { include: { location: true, skill: true } },
    },
    take: 20,
    orderBy: { shift: { location: { name: 'asc' } } },
  })

  // Upcoming shifts for current user
  const upcomingShifts = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      shift: {
        status: 'PUBLISHED',
        startTime: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 3600000) },
      },
    },
    include: { shift: { include: { location: true, skill: true } } },
    orderBy: { shift: { startTime: 'asc' } },
    take: 5,
  })

  // Pending swap requests
  const pendingSwaps = await prisma.swapRequest.findMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED'] },
      ...(role === 'STAFF' ? { OR: [{ requesterId: userId }, { targetUserId: userId }] } : {}),
      ...(role === 'MANAGER' ? { shift: { location: { managers: { some: { userId } } } } } : {}),
    },
    include: {
      shift: { include: { location: true } },
      requester: { select: { name: true } },
      target: { select: { name: true } },
    },
    take: 5,
  })

  // This week's hours for current user
  const weekAssignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      shift: { status: 'PUBLISHED', startTime: { gte: weekStart, lte: weekEnd } },
    },
    include: { shift: true },
  })
  const weeklyHours = weekAssignments.reduce(
    (sum, a) => sum + shiftDurationHours(a.shift.startTime, a.shift.endTime),
    0
  )

  return ok({ onDuty, upcomingShifts, pendingSwaps, weeklyHours })
}
