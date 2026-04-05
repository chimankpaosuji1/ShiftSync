import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { hash } from 'bcryptjs'

export async function GET(req: Request) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const role = searchParams.get('role')
  const skillId = searchParams.get('skillId')

  const where: Record<string, unknown> = { isActive: true }
  if (role) where.role = role
  if (skillId) where.skills = { some: { skillId } }

  // Managers can only see staff at their locations
  if (session!.user.role === 'MANAGER') {
    const managed = await prisma.locationManager.findMany({
      where: { userId: session!.user.id },
      select: { locationId: true },
    })
    const managedIds = managed.map((m) => m.locationId)

    if (locationId && !managedIds.includes(locationId)) {
      return err('Forbidden', 403)
    }

    where.certifications = { some: { locationId: { in: locationId ? [locationId] : managedIds } } }
  } else if (locationId) {
    where.certifications = { some: { locationId } }
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      skills: { include: { skill: true } },
      certifications: { include: { location: true } },
    },
    orderBy: { name: 'asc' },
  })

  return ok(users.map(({ password: _, ...u }) => u))
}

export async function POST(req: Request) {
  const { error } = await requireRole(['ADMIN'])
  if (error) return error

  const body = await req.json()
  const { email, password, name, role, desiredHours, skills, certifications, managedLocations } = body

  if (!email || !password || !name) return err('email, password, name required')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return err('Email already in use')

  const hashed = await hash(password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: role || 'STAFF',
        desiredHours: desiredHours || 40,
        skills: skills?.length ? { create: skills.map((skillId: string) => ({ skillId })) } : undefined,
        certifications: certifications?.length
          ? { create: certifications.map((locationId: string) => ({ locationId })) }
          : undefined,
        managedLocations: managedLocations?.length
          ? { create: managedLocations.map((locationId: string) => ({ locationId })) }
          : undefined,
      },
      include: {
        skills: { include: { skill: true } },
        certifications: { include: { location: true } },
      },
    })
    const { password: _, ...safeUser } = user
    return ok(safeUser, 201)
  } catch (e) {
    console.error('[POST /api/users]', e)
    return err(e instanceof Error ? e.message : 'Failed to create user', 500)
  }
}
