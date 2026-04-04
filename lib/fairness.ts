import { prisma } from './db'
import { shiftDurationHours } from './timezone'
import { FairnessReport } from '@/types'

export async function getFairnessReport(
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<FairnessReport[]> {
  // Get all active staff certified at this location
  const certifications = await prisma.locationCertification.findMany({
    where: { locationId },
    include: { user: { select: { id: true, name: true, desiredHours: true, isActive: true } } },
  })

  const staff = certifications.filter((c) => c.user.isActive)

  const reports: FairnessReport[] = []

  for (const { user } of staff) {
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        shift: {
          locationId,
          status: 'PUBLISHED',
          startTime: { gte: startDate, lte: endDate },
        },
      },
      include: { shift: true },
    })

    const totalHours = assignments.reduce(
      (sum, a) => sum + shiftDurationHours(a.shift.startTime, a.shift.endTime),
      0
    )
    const totalShifts = assignments.length
    const premiumShifts = assignments.filter((a) => a.shift.isPremium).length

    // Calculate fairness score (0-100)
    // Based on ratio of premium shifts to total shifts compared to location average
    // Higher score = more equitable distribution
    const totalWeeks = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 3600000)))
    const desiredWeeklyHours = user.desiredHours
    const expectedTotalHours = desiredWeeklyHours * totalWeeks
    const hoursVariance = totalHours - expectedTotalHours

    reports.push({
      userId: user.id,
      userName: user.name,
      totalHours,
      premiumShifts,
      totalShifts,
      desiredHours: desiredWeeklyHours * totalWeeks,
      hoursVariance,
      premiumFairnessScore: 0, // computed below
    })
  }

  // Compute premium fairness score relative to group
  const totalPremium = reports.reduce((sum, r) => sum + r.premiumShifts, 0)
  const totalShiftsAll = reports.reduce((sum, r) => sum + r.totalShifts, 0)
  const avgPremiumRate = totalShiftsAll > 0 ? totalPremium / totalShiftsAll : 0

  for (const report of reports) {
    if (report.totalShifts === 0) {
      report.premiumFairnessScore = 100 // No shifts assigned — no unfairness
      continue
    }
    const personalRate = report.premiumShifts / report.totalShifts
    const deviation = Math.abs(personalRate - avgPremiumRate)
    // Score: 100 = perfect equity, decreasing with deviation
    report.premiumFairnessScore = Math.max(0, Math.round(100 - deviation * 200))
  }

  return reports.sort((a, b) => b.hoursVariance - a.hoursVariance)
}

export async function getPremiumShiftDistribution(
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<{ userId: string; userName: string; premiumCount: number; regularCount: number }[]> {
  const report = await getFairnessReport(locationId, startDate, endDate)
  return report.map((r) => ({
    userId: r.userId,
    userName: r.userName,
    premiumCount: r.premiumShifts,
    regularCount: r.totalShifts - r.premiumShifts,
  }))
}
