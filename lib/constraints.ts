/**
 * Constraint Enforcement Engine
 *
 * All scheduling rules are enforced here. Each check returns violations
 * with clear explanations and suggestions where possible.
 */

import { prisma } from './db'
import { shiftDurationHours, isWithinAvailability, getDayOfWeekInTimezone } from './timezone'
import { ConstraintViolation, AssignmentCheckResult } from '@/types'
import { differenceInMinutes } from 'date-fns'

const MIN_REST_HOURS = 10
const DAILY_WARN_HOURS = 8
const DAILY_HARD_BLOCK_HOURS = 12
const WEEKLY_WARN_HOURS = 35
const WEEKLY_OT_HOURS = 40
const EDIT_CUTOFF_HOURS = 48

export async function checkAssignmentConstraints(
  userId: string,
  shiftId: string,
  options: { skipRestCheck?: boolean } = {}
): Promise<AssignmentCheckResult> {
  const violations: ConstraintViolation[] = []
  const warnings: ConstraintViolation[] = []

  // Load shift with location and skill
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { location: true, skill: true },
  })
  if (!shift) {
    return {
      allowed: false,
      violations: [{ type: 'DOUBLE_BOOKING', severity: 'ERROR', message: 'Shift not found' }],
      warnings: [],
    }
  }

  // Load user with skills and certifications
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      skills: { include: { skill: true } },
      certifications: { include: { location: true } },
      availability: true,
    },
  })
  if (!user) {
    return {
      allowed: false,
      violations: [{ type: 'DOUBLE_BOOKING', severity: 'ERROR', message: 'User not found' }],
      warnings: [],
    }
  }

  const shiftStart = new Date(shift.startTime)
  const shiftEnd = new Date(shift.endTime)

  // 1. SKILL CHECK
  const hasSkill = user.skills.some((us) => us.skillId === shift.skillId)
  if (!hasSkill) {
    violations.push({
      type: 'SKILL_MISMATCH',
      severity: 'ERROR',
      message: `${user.name} does not have the required skill: "${shift.skill.name}"`,
      detail: `${user.name}'s skills: ${user.skills.map((s) => s.skill.name).join(', ') || 'none'}`,
      suggestion: `Assign a staff member with the "${shift.skill.name}" skill`,
    })
  }

  // 2. LOCATION CERTIFICATION CHECK
  const hasCert = user.certifications.some((c) => c.locationId === shift.locationId)
  if (!hasCert) {
    violations.push({
      type: 'LOCATION_NOT_CERTIFIED',
      severity: 'ERROR',
      message: `${user.name} is not certified to work at ${shift.location.name}`,
      detail: `Certified locations: ${user.certifications.map((c) => c.location.name).join(', ') || 'none'}`,
      suggestion: `Certify ${user.name} for ${shift.location.name} first, or choose a different staff member`,
    })
  }

  // 3. DOUBLE-BOOKING CHECK (overlapping shifts, even at different locations)
  const overlapping = await prisma.shiftAssignment.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      shift: {
        id: { not: shiftId },
        status: { not: 'CANCELLED' },
        startTime: { lt: shiftEnd },
        endTime: { gt: shiftStart },
      },
    },
    include: { shift: { include: { location: true } } },
  })
  if (overlapping) {
    violations.push({
      type: 'DOUBLE_BOOKING',
      severity: 'ERROR',
      message: `${user.name} is already assigned to an overlapping shift`,
      detail: `Conflict with shift at ${overlapping.shift.location.name}: ${overlapping.shift.startTime.toISOString()} – ${overlapping.shift.endTime.toISOString()}`,
      suggestion: `Remove ${user.name} from the conflicting shift first`,
    })
  }

  // 4. REST PERIOD CHECK (10 hours between consecutive shifts)
  if (!options.skipRestCheck) {
    const restWindowStart = new Date(shiftStart.getTime() - MIN_REST_HOURS * 3600000)
    const restWindowEnd = new Date(shiftEnd.getTime() + MIN_REST_HOURS * 3600000)

    const tooClose = await prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        shift: {
          id: { not: shiftId },
          status: { not: 'CANCELLED' },
          OR: [
            // Shift ending too close before this one starts
            { endTime: { gt: restWindowStart, lte: shiftStart } },
            // Shift starting too close after this one ends
            { startTime: { gte: shiftEnd, lt: restWindowEnd } },
          ],
        },
      },
      include: { shift: { include: { location: true } } },
    })
    if (tooClose) {
      const gap = differenceInMinutes(
        tooClose.shift.startTime > shiftStart ? tooClose.shift.startTime : shiftStart,
        tooClose.shift.endTime < shiftEnd ? tooClose.shift.endTime : shiftEnd
      )
      violations.push({
        type: 'REST_PERIOD',
        severity: 'ERROR',
        message: `${user.name} needs at least 10 hours of rest between shifts`,
        detail: `Only ${Math.abs(Math.round(gap / 60))} hours between shifts. Nearby shift at ${tooClose.shift.location.name}`,
        suggestion: `Ensure at least 10 hours between shift end and next shift start`,
      })
    }
  }

  // 5. AVAILABILITY CHECK
  // Use location timezone for the shift day check, but user sets availability in their own reference
  // Policy decision: We use the LOCATION timezone for day-of-week and time matching,
  // since that's where the user will physically be working.
  const locationTimezone = shift.location.timezone
  const shiftDayOfWeek = getDayOfWeekInTimezone(shiftStart, locationTimezone)

  // Check exceptions first (specific date overrides recurring)
  const shiftLocalDate = new Date(shiftStart).toISOString().split('T')[0]
  const exceptions = user.availability.filter((a) => a.type === 'EXCEPTION')
  let availabilityStatus: 'available' | 'unavailable' | 'no-data' = 'no-data'

  for (const exc of exceptions) {
    if (exc.date === shiftLocalDate) {
      if (!exc.isAvailable) {
        availabilityStatus = 'unavailable'
        break
      } else {
        // Check time window
        const inWindow = isWithinAvailability(
          shiftStart, shiftEnd,
          exc.startTime, exc.endTime,
          null,
          locationTimezone
        )
        availabilityStatus = inWindow ? 'available' : 'unavailable'
        break
      }
    }
  }

  if (availabilityStatus === 'no-data') {
    // Check recurring availability
    const recurring = user.availability.filter(
      (a) => a.type === 'RECURRING' && a.dayOfWeek === shiftDayOfWeek
    )
    if (recurring.length === 0) {
      // No availability set for this day — treat as available but warn
      warnings.push({
        type: 'UNAVAILABLE',
        severity: 'WARNING',
        message: `${user.name} has no availability set for this day of week`,
        detail: `No recurring availability on day ${shiftDayOfWeek}`,
        suggestion: `Confirm with ${user.name} before assigning`,
      })
    } else {
      const anyMatch = recurring.some((a) => {
        if (!a.isAvailable) return false
        return isWithinAvailability(shiftStart, shiftEnd, a.startTime, a.endTime, a.dayOfWeek, locationTimezone)
      })
      if (!anyMatch) {
        availabilityStatus = 'unavailable'
      } else {
        availabilityStatus = 'available'
      }
    }
  }

  if (availabilityStatus === 'unavailable') {
    violations.push({
      type: 'UNAVAILABLE',
      severity: 'ERROR',
      message: `${user.name} is not available during this shift`,
      detail: `Their availability windows do not cover this shift time`,
      suggestion: `Check ${user.name}'s availability settings or assign during their available hours`,
    })
  }

  // 6. DAILY HOURS CHECK
  const shiftDayStart = new Date(shiftStart)
  shiftDayStart.setUTCHours(0, 0, 0, 0)
  const shiftDayEnd = new Date(shiftDayStart)
  shiftDayEnd.setUTCHours(23, 59, 59, 999)

  const dayAssignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      shift: {
        status: { not: 'CANCELLED' },
        startTime: { gte: shiftDayStart, lte: shiftDayEnd },
        id: { not: shiftId },
      },
    },
    include: { shift: true },
  })

  const existingDailyHours = dayAssignments.reduce(
    (sum, a) => sum + shiftDurationHours(a.shift.startTime, a.shift.endTime),
    0
  )
  const newShiftHours = shiftDurationHours(shiftStart, shiftEnd)
  const totalDailyHours = existingDailyHours + newShiftHours

  if (totalDailyHours > DAILY_HARD_BLOCK_HOURS) {
    violations.push({
      type: 'OVERTIME_HARD_BLOCK',
      severity: 'ERROR',
      message: `Assignment would give ${user.name} ${totalDailyHours.toFixed(1)} hours in one day (max: 12)`,
      detail: `Already scheduled ${existingDailyHours.toFixed(1)}h, this shift adds ${newShiftHours.toFixed(1)}h`,
      suggestion: `Reduce shift length or assign a different staff member`,
    })
  } else if (totalDailyHours > DAILY_WARN_HOURS) {
    warnings.push({
      type: 'OVERTIME_WARNING',
      severity: 'WARNING',
      message: `${user.name} will work ${totalDailyHours.toFixed(1)} hours today (over 8h threshold)`,
      detail: `Already scheduled ${existingDailyHours.toFixed(1)}h today`,
    })
  }

  // 7. WEEKLY HOURS CHECK
  const { start: weekStart, end: weekEnd } = getWeekBoundsSimple(shiftStart)
  const weekAssignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      shift: {
        status: { not: 'CANCELLED' },
        startTime: { gte: weekStart, lte: weekEnd },
        id: { not: shiftId },
      },
    },
    include: { shift: true },
  })

  const existingWeeklyHours = weekAssignments.reduce(
    (sum, a) => sum + shiftDurationHours(a.shift.startTime, a.shift.endTime),
    0
  )
  const totalWeeklyHours = existingWeeklyHours + newShiftHours

  if (totalWeeklyHours > WEEKLY_OT_HOURS) {
    warnings.push({
      type: 'OVERTIME_WARNING',
      severity: 'WARNING',
      message: `${user.name} will exceed 40 hours this week (${totalWeeklyHours.toFixed(1)}h projected)`,
      detail: `${(totalWeeklyHours - WEEKLY_OT_HOURS).toFixed(1)} hours of overtime`,
      suggestion: `Consider a part-time employee to avoid overtime costs`,
    })
  } else if (totalWeeklyHours >= WEEKLY_WARN_HOURS) {
    warnings.push({
      type: 'OVERTIME_WARNING',
      severity: 'WARNING',
      message: `${user.name} is approaching 40 hours this week (${totalWeeklyHours.toFixed(1)}h projected)`,
      detail: `${(WEEKLY_OT_HOURS - totalWeeklyHours).toFixed(1)} hours until overtime threshold`,
    })
  }

  // 8. CONSECUTIVE DAYS CHECK
  // 6th day = WARNING (allow with caution)
  // 7th day = ERROR (hard block requiring manager override with documented reason)
  const consecutiveDays = await countConsecutiveDays(userId, shiftStart)
  if (consecutiveDays >= 6) {
    const dayNumber = consecutiveDays + 1
    if (consecutiveDays >= 6 && dayNumber >= 7) {
      // 7th+ consecutive day: ERROR — requires manager override
      violations.push({
        type: 'CONSECUTIVE_DAYS',
        severity: 'ERROR',
        message: `${user.name} would work their 7th consecutive day — manager override required`,
        detail: `${user.name} has already worked ${consecutiveDays} consecutive days this week`,
        suggestion: `Provide an override reason or rotate with another staff member`,
      })
    } else {
      // 6th consecutive day: WARNING only
      warnings.push({
        type: 'CONSECUTIVE_DAYS',
        severity: 'WARNING',
        message: `${user.name} would work their ${dayNumber}th consecutive day`,
        detail: `${user.name} has already worked ${consecutiveDays} consecutive days`,
        suggestion: `Consider rotating with another staff member`,
      })
    }
  }

  // Determine if assignment is allowed (only ERROR violations block)
  const hasErrors = violations.length > 0

  // Find suggested alternatives if blocked
  let suggestedAlternatives: import('@/types').UserSummary[] | undefined
  if (hasErrors) {
    suggestedAlternatives = (await findAlternatives(shiftId, userId)) as import('@/types').UserSummary[]
  }

  return {
    allowed: !hasErrors,
    violations,
    warnings,
    suggestedAlternatives,
  }
}

// Check if a shift can be edited (within edit cutoff window)
export function checkEditCutoff(shift: { startTime: Date; status: string }): ConstraintViolation | null {
  if (shift.status !== 'PUBLISHED') return null
  const hoursUntilShift = differenceInMinutes(shift.startTime, new Date()) / 60
  if (hoursUntilShift < EDIT_CUTOFF_HOURS) {
    return {
      type: 'EDIT_CUTOFF',
      severity: 'ERROR',
      message: `Cannot edit a published shift within ${EDIT_CUTOFF_HOURS} hours of start time`,
      detail: `Shift starts in ${hoursUntilShift.toFixed(1)} hours`,
      suggestion: `Contact affected staff directly or use emergency override`,
    }
  }
  return null
}

async function countConsecutiveDays(userId: string, referenceDate: Date): Promise<number> {
  // Count days worked in the 7 days preceding the reference date
  let count = 0
  for (let i = 1; i <= 7; i++) {
    const dayStart = new Date(referenceDate)
    dayStart.setUTCDate(referenceDate.getUTCDate() - i)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const worked = await prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        shift: {
          status: { not: 'CANCELLED' },
          startTime: { gte: dayStart, lte: dayEnd },
        },
      },
    })
    if (worked) count++
    else break
  }
  return count
}

async function findAlternatives(shiftId: string, excludeUserId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { location: true },
  })
  if (!shift) return []

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      isActive: true,
      role: 'STAFF',
      skills: { some: { skillId: shift.skillId } },
      certifications: { some: { locationId: shift.locationId } },
    },
    take: 5,
    select: { id: true, name: true, email: true, role: true, desiredHours: true, avatarUrl: true, isActive: true },
  })

  return candidates
}

function getWeekBoundsSimple(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() + diff)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

// Validate shift times — endTime must be after startTime (overnight handled by caller
// advancing the end date by one day before converting to UTC)
export function validateShiftTimes(
  startTime: Date,
  endTime: Date
): ConstraintViolation | null {
  const durationHours = differenceInMinutes(endTime, startTime) / 60
  if (durationHours <= 0) {
    return {
      type: 'OVERTIME_HARD_BLOCK',
      severity: 'ERROR',
      message: 'Shift end time must be after start time',
      detail: `For overnight shifts, the end time on the next day is handled automatically.`,
    }
  }
  if (durationHours > 24) {
    return {
      type: 'OVERTIME_HARD_BLOCK',
      severity: 'ERROR',
      message: `Shift duration cannot exceed 24 hours (got ${durationHours.toFixed(1)}h)`,
      detail: `Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`,
    }
  }
  return null
}
