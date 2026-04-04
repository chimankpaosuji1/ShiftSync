import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const shiftId = searchParams.get('shiftId')
  const locationId = searchParams.get('locationId')
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const take = parseInt(searchParams.get('take') || '100')

  const where: Record<string, unknown> = {}
  if (shiftId) where.shiftId = shiftId
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    }
  }

  // Managers scoped to their location's shifts
  if (session!.user.role === 'MANAGER' && locationId) {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId } },
    })
    if (!manages) return err('Forbidden', 403)
    where.shift = { locationId }
  } else if (locationId) {
    where.shift = { locationId }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      shift: { include: { location: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  return ok(logs)
}
