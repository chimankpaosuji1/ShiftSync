import { requireAuth, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: {
      skills: { include: { skill: true } },
      certifications: { include: { location: true } },
      managedLocations: { include: { location: true } },
      notificationPrefs: true,
    },
  })
  if (!user) return err('User not found', 404)

  const { password: _, ...safeUser } = user
  return ok(safeUser)
}

export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { name, phone, desiredHours, notificationPrefs } = body

  const updated = await prisma.user.update({
    where: { id: session!.user.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(desiredHours !== undefined && { desiredHours: Number(desiredHours) }),
    },
  })

  if (notificationPrefs) {
    await prisma.notificationPreference.upsert({
      where: { userId: session!.user.id },
      update: notificationPrefs,
      create: { userId: session!.user.id, ...notificationPrefs },
    })
  }

  const { password: _, ...safeUser } = updated
  return ok(safeUser)
}
