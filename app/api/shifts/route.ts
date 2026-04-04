import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { isPremiumShift } from '@/lib/timezone'
import { createAuditLog } from '@/lib/audit'
import { validateShiftTimes } from '@/lib/constraints'

export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const weekStart = searchParams.get('weekStart')
  const weekEnd = searchParams.get('weekEnd')
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (locationId) where.locationId = locationId
  if (weekStart && weekEnd) {
    where.startTime = { gte: new Date(weekStart), lte: new Date(weekEnd) }
  }

  // Scope to manager's locations
  if (session!.user.role === 'MANAGER') {
    const managed = await prisma.locationManager.findMany({
      where: { userId: session!.user.id },
      select: { locationId: true },
    })
    const managedIds = managed.map((m) => m.locationId)
    if (locationId && !managedIds.includes(locationId)) return err('Forbidden', 403)
    if (!locationId) where.locationId = { in: managedIds }
  }

  // Staff see only published shifts at their certified locations (or their own assignments)
  if (session!.user.role === 'STAFF') {
    const certs = await prisma.locationCertification.findMany({
      where: { userId: session!.user.id },
      select: { locationId: true },
    })
    const certIds = certs.map((c) => c.locationId)
    where.locationId = locationId && certIds.includes(locationId) ? locationId : { in: certIds }
    where.status = 'PUBLISHED'
  }

  // Filter by userId (shifts assigned to a specific person)
  if (userId) {
    where.assignments = { some: { userId, status: 'ACTIVE' } }
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      location: true,
      skill: true,
      assignments: {
        where: { status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
    },
    orderBy: { startTime: 'asc' },
  })

  const mapped = shifts.map((s) => ({
    ...s,
    // Flat fields expected by ShiftSummary / ShiftCard
    locationName: s.location.name,
    locationTimezone: s.location.timezone,
    skillName: s.skill.name,
    skillColor: (s.skill as any).color ?? '#6366f1',
    assignmentCount: s.assignments.length,
    assignments: s.assignments.map((a) => ({
      ...a,
      userName: (a as any).user?.name ?? '',
      userEmail: (a as any).user?.email ?? '',
      avatarUrl: (a as any).user?.avatarUrl ?? null,
    })),
  }))

  return ok(mapped)
}

export async function POST(req: Request) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error

  const body = await req.json()
  const { locationId, skillId, startTime, endTime, headcount, notes } = body

  if (!locationId || !skillId || !startTime || !endTime) {
    return err('locationId, skillId, startTime, endTime required')
  }

  // Managers can only create shifts at their locations
  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId } },
    })
    if (!manages) return err('Forbidden: not your location', 403)
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } })
  if (!location) return err('Location not found', 404)

  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return err('Invalid date format')

  const timeError = validateShiftTimes(start, end)
  if (timeError) return err(timeError.message, 422)

  const premium = isPremiumShift(start, location.timezone)

  const shift = await prisma.shift.create({
    data: {
      locationId,
      skillId,
      startTime: start,
      endTime: end,
      headcount: headcount || 1,
      isPremium: premium,
      notes,
      createdBy: session!.user.id,
      status: 'DRAFT',
    },
    include: { location: true, skill: true, assignments: true },
  })

  await createAuditLog({
    actorId: session!.user.id,
    action: 'SHIFT_CREATED',
    entityType: 'SHIFT',
    entityId: shift.id,
    shiftId: shift.id,
    after: shift,
  })

  return ok(shift, 201)
}
