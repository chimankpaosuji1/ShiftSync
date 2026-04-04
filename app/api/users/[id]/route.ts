import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { hash } from 'bcryptjs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params

  // Staff can only view themselves; managers/admins can view others
  if (session!.user.role === 'STAFF' && session!.user.id !== id) {
    return err('Forbidden', 403)
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true } },
      certifications: { include: { location: true } },
      managedLocations: { include: { location: true } },
      availability: { orderBy: [{ dayOfWeek: 'asc' }, { date: 'asc' }] },
    },
  })
  if (!user) return err('Not found', 404)

  const { password: _, ...safeUser } = user
  return ok(safeUser)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params

  const isAdmin = session!.user.role === 'ADMIN'
  const isSelf = session!.user.id === id

  if (!isAdmin && !isSelf) return err('Forbidden', 403)

  const body = await req.json()
  const { name, phone, desiredHours, isActive, role, password, skills, certifications, managedLocations } = body

  // Only admins can change role, isActive, certifications, managedLocations
  if (!isAdmin && (role || isActive !== undefined || certifications || managedLocations)) {
    return err('Forbidden: only admins can change role/certifications', 403)
  }

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (desiredHours !== undefined) updateData.desiredHours = Number(desiredHours)
  if (isAdmin && isActive !== undefined) updateData.isActive = isActive
  if (isAdmin && role) updateData.role = role
  if (password) updateData.password = await hash(password, 12)

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: updateData })

    if (skills !== undefined) {
      await tx.userSkill.deleteMany({ where: { userId: id } })
      if (skills.length) {
        await tx.userSkill.createMany({ data: skills.map((skillId: string) => ({ userId: id, skillId })) })
      }
    }

    if (isAdmin && certifications !== undefined) {
      await tx.locationCertification.deleteMany({ where: { userId: id } })
      if (certifications.length) {
        await tx.locationCertification.createMany({
          data: certifications.map((locationId: string) => ({ userId: id, locationId })),
        })
      }
    }

    if (isAdmin && managedLocations !== undefined) {
      await tx.locationManager.deleteMany({ where: { userId: id } })
      if (managedLocations.length) {
        await tx.locationManager.createMany({
          data: managedLocations.map((locationId: string) => ({ userId: id, locationId })),
        })
      }
    }

    return updated
  })

  const { password: _, ...safeUser } = user
  return ok(safeUser)
}
