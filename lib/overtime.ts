import { prisma } from './db'
import { shiftDurationHours } from './timezone'
import { OvertimeStatus } from '@/types'

const HOURLY_RATE_ESTIMATE = 18 // base rate for overtime cost estimation
const OT_MULTIPLIER = 1.5

export async function getOvertimeStatus(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<OvertimeStatus> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      shift: {
        status: { not: 'CANCELLED' },
        startTime: { gte: weekStart, lte: weekEnd },
      },
    },
    include: { shift: true },
    orderBy: { shift: { startTime: 'asc' } },
  })

  const shifts = assignments.map((a) => a.shift)

  // Weekly hours
  const weeklyHours = shifts.reduce(
    (sum, s) => sum + shiftDurationHours(s.startTime, s.endTime),
    0
  )

  // Daily max
  const dailyHoursMap: Record<string, number> = {}
  for (const s of shifts) {
    const day = s.startTime.toISOString().split('T')[0]
    const dur = shiftDurationHours(s.startTime, s.endTime)
    dailyHoursMap[day] = (dailyHoursMap[day] || 0) + dur
  }
  const dailyHoursMax = Math.max(0, ...Object.values(dailyHoursMap))

  // Consecutive days
  const consecutiveDays = countConsecutive(shifts, weekStart, weekEnd)

  // Overtime cost
  const overtimeHours = Math.max(0, weeklyHours - 40)
  const projectedOvertimeCost = overtimeHours * HOURLY_RATE_ESTIMATE * OT_MULTIPLIER

  // Warnings
  const warnings: string[] = []
  if (weeklyHours >= 35 && weeklyHours < 40) {
    warnings.push(`Approaching 40h/week (${weeklyHours.toFixed(1)}h scheduled)`)
  }
  if (weeklyHours >= 40) {
    warnings.push(`Over 40h/week — ${overtimeHours.toFixed(1)}h overtime`)
  }
  if (dailyHoursMax > 8 && dailyHoursMax <= 12) {
    warnings.push(`Daily hours exceed 8h (max today: ${dailyHoursMax.toFixed(1)}h)`)
  }
  if (dailyHoursMax > 12) {
    warnings.push(`BLOCKED: Daily hours exceed 12h (${dailyHoursMax.toFixed(1)}h)`)
  }
  if (consecutiveDays >= 6) {
    warnings.push(`Working ${consecutiveDays} consecutive days`)
  }

  return {
    userId,
    userName: user.name,
    weeklyHours,
    dailyHoursMax,
    consecutiveDays,
    projectedOvertimeCost,
    overtimeHours,
    warnings,
    isHardBlocked: dailyHoursMax > 12,
  }
}

export async function getWeekOvertimeSummary(
  locationId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{
  totalOvertimeCost: number
  staffAtRisk: OvertimeStatus[]
  overtimeAssignments: { assignmentId: string; userId: string; overtimeHours: number }[]
}> {
  // Get all staff with assignments this week at this location
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      status: 'ACTIVE',
      shift: {
        locationId,
        status: { not: 'CANCELLED' },
        startTime: { gte: weekStart, lte: weekEnd },
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  const userIds = assignments.map((a) => a.userId)
  const statuses = await Promise.all(userIds.map((uid) => getOvertimeStatus(uid, weekStart, weekEnd)))
  const staffAtRisk = statuses.filter((s) => s.weeklyHours >= 35 || s.isHardBlocked)
  const totalOvertimeCost = statuses.reduce((sum, s) => sum + s.projectedOvertimeCost, 0)

  // Identify which specific assignment pushed each at-risk person over 40h
  const overtimeAssignments: { assignmentId: string; userId: string; overtimeHours: number }[] = []
  for (const status of staffAtRisk) {
    if (status.overtimeHours <= 0) continue

    // Fetch this user's assignments this week ordered by start time
    const userAssignments = await prisma.shiftAssignment.findMany({
      where: {
        userId: status.userId,
        status: 'ACTIVE',
        shift: {
          locationId,
          status: { not: 'CANCELLED' },
          startTime: { gte: weekStart, lte: weekEnd },
        },
      },
      include: { shift: true },
      orderBy: { shift: { startTime: 'asc' } },
    })

    let runningHours = 0
    for (const a of userAssignments) {
      const dur = shiftDurationHours(a.shift.startTime, a.shift.endTime)
      const before = runningHours
      runningHours += dur
      if (before < 40 && runningHours > 40) {
        // This is the assignment that crosses the threshold
        overtimeAssignments.push({
          assignmentId: a.id,
          userId: status.userId,
          overtimeHours: runningHours - 40,
        })
        break
      }
    }
  }

  return { totalOvertimeCost, staffAtRisk, overtimeAssignments }
}

function countConsecutive(
  shifts: { startTime: Date }[],
  weekStart: Date,
  weekEnd: Date
): number {
  if (shifts.length === 0) return 0
  const workedDays = new Set(shifts.map((s) => s.startTime.toISOString().split('T')[0]))
  let max = 0
  let current = 0
  const start = new Date(weekStart)
  for (let i = 0; i < 7; i++) {
    const day = start.toISOString().split('T')[0]
    if (workedDays.has(day)) {
      current++
      max = Math.max(max, current)
    } else {
      current = 0
    }
    start.setUTCDate(start.getUTCDate() + 1)
  }
  return max
}
