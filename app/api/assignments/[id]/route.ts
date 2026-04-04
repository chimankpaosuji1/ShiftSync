import { requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(['ADMIN', 'MANAGER'])
  if (error) return error
  const { id } = await params

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id },
    include: { shift: true },
  })
  if (!assignment) return err('Not found', 404)

  if (session!.user.role === 'MANAGER') {
    const manages = await prisma.locationManager.findUnique({
      where: { userId_locationId: { userId: session!.user.id, locationId: assignment.shift.locationId } },
    })
    if (!manages) return err('Forbidden', 403)
  }

  await prisma.shiftAssignment.update({ where: { id }, data: { status: 'CANCELLED' } })
  await createAuditLog({
    actorId: session!.user.id,
    action: 'ASSIGNMENT_REMOVED',
    entityType: 'ASSIGNMENT',
    entityId: id,
    shiftId: assignment.shiftId,
    before: assignment,
  })

  return ok({ success: true })
}
