import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const role = session!.user.role
  const userId = session!.user.id

  let locations

  if (role === 'ADMIN') {
    locations = await prisma.location.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { shifts: true, certifications: true } },
      },
      orderBy: { name: 'asc' },
    })
  } else if (role === 'MANAGER') {
    locations = await prisma.location.findMany({
      where: {
        isActive: true,
        managers: { some: { userId } },
      },
      include: {
        _count: { select: { shifts: true, certifications: true } },
      },
      orderBy: { name: 'asc' },
    })
  } else {
    // Staff: locations they're certified for
    locations = await prisma.location.findMany({
      where: {
        isActive: true,
        certifications: { some: { userId } },
      },
      orderBy: { name: 'asc' },
    })
  }

  return ok(locations)
}

export async function POST(req: Request) {
  const { error } = await requireRole(['ADMIN'])
  if (error) return error

  const body = await req.json()
  const { name, address, city, state, timezone } = body

  if (!name || !timezone) return err('name and timezone required')

  const location = await prisma.location.create({
    data: { name, address: address || '', city: city || '', state: state || '', timezone },
  })

  return ok(location, 201)
}
