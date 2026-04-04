import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(['ADMIN'])
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const { name, address, city, state, timezone, isActive } = body

  const location = await prisma.location.findUnique({ where: { id } })
  if (!location) return err('Location not found', 404)

  const updated = await prisma.location.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(timezone !== undefined && { timezone }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { _count: { select: { shifts: true, certifications: true } } },
  })

  return ok(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(['ADMIN'])
  if (error) return error

  const { id } = await params

  const location = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { shifts: true } } },
  })
  if (!location) return err('Location not found', 404)

  if (location._count.shifts > 0) {
    return err('Cannot delete a location that has shifts. Deactivate it instead.', 422)
  }

  await prisma.location.delete({ where: { id } })
  return ok({ deleted: true })
}
