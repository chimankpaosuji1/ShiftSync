import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { getFairnessReport } from '@/lib/fairness'
import { getWeekOvertimeSummary, getOvertimeStatus } from '@/lib/overtime'
import { getWeekBounds } from '@/lib/timezone'

export async function GET(req: Request) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'fairness'
  const locationId = searchParams.get('locationId')
  const weekParam = searchParams.get('week') // ISO date
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  // Validate location access for managers
  if (session!.user.role === 'MANAGER' && locationId) {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  if (type === 'fairness') {
    if (!locationId) return err('locationId required for fairness report')
    const start = startParam ? new Date(startParam) : new Date(Date.now() - 28 * 24 * 3600000)
    const end = endParam ? new Date(endParam) : new Date()
    const report = await getFairnessReport(locationId, start, end)
    return ok(report)
  }

  if (type === 'overtime') {
    if (!locationId) return err('locationId required for overtime report')
    const refDate = weekParam ? new Date(weekParam) : new Date()
    const { start, end } = getWeekBounds(refDate)
    const summary = await getWeekOvertimeSummary(locationId, start, end)
    return ok(summary)
  }

  if (type === 'on-duty') {
    // Who is currently clocked in (shift in progress right now)
    const now = new Date()
    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      shift: {
        status: 'PUBLISHED',
        startTime: { lte: now },
        endTime: { gte: now },
      },
    }
    if (locationId) where.shift = { ...where.shift as object, locationId }

    const onDuty = await prisma.shiftAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        shift: { include: { location: true, skill: true } },
      },
    })
    return ok(onDuty)
  }

  if (type === 'hours-distribution') {
    const start = startParam ? new Date(startParam) : new Date(Date.now() - 28 * 24 * 3600000)
    const end = endParam ? new Date(endParam) : new Date()

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      shift: { status: 'PUBLISHED', startTime: { gte: start, lte: end } },
    }
    if (locationId) where.shift = { ...where.shift as object, locationId }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        shift: { select: { startTime: true, endTime: true } },
      },
    })

    const hoursMap: Record<string, { userId: string; userName: string; hours: number }> = {}
    for (const a of assignments) {
      const key = a.userId
      if (!hoursMap[key]) hoursMap[key] = { userId: a.userId, userName: a.user.name, hours: 0 }
      const dur = (a.shift.endTime.getTime() - a.shift.startTime.getTime()) / 3600000
      hoursMap[key].hours += dur
    }

    return ok(Object.values(hoursMap).sort((a, b) => b.hours - a.hours))
  }

  return err('Unknown analytics type')
}
