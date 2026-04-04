import { requireAuth, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { notifyAvailabilityChanged } from '@/lib/notifications'

export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || session!.user.id

  // Managers/admins can view any user's availability
  if (userId !== session!.user.id && session!.user.role === 'STAFF') {
    return err('Forbidden', 403)
  }

  const availability = await prisma.availability.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { dayOfWeek: 'asc' }, { date: 'asc' }],
  })

  return ok(availability)
}

export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { type, dayOfWeek, date, startTime, endTime, isAvailable, note } = body

  // Staff can only set their own availability
  const userId = session!.user.role === 'STAFF' ? session!.user.id : (body.userId || session!.user.id)

  if (!startTime || !endTime) return err('startTime and endTime required')
  if (type === 'RECURRING' && dayOfWeek === undefined) return err('dayOfWeek required for RECURRING')
  if (type === 'EXCEPTION' && !date) return err('date required for EXCEPTION')

  const avail = await prisma.availability.create({
    data: { userId, type: type || 'RECURRING', dayOfWeek, date, startTime, endTime, isAvailable: isAvailable ?? true, note },
  })

  // Notify managers that this staff member changed their availability
  const staffUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (staffUser) {
    const dayLabel = type === 'RECURRING'
      ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek] ?? `day ${dayOfWeek}`
      : date ?? 'a specific date'
    const changeDesc = `${isAvailable ?? true ? 'available' : 'unavailable'} on ${dayLabel} ${startTime}–${endTime}`
    await notifyAvailabilityChanged(userId, staffUser.name, changeDesc).catch(() => {})
  }

  return ok(avail, 201)
}

export async function DELETE(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return err('id required')

  const avail = await prisma.availability.findUnique({ where: { id } })
  if (!avail) return err('Not found', 404)
  if (avail.userId !== session!.user.id && session!.user.role === 'STAFF') return err('Forbidden', 403)

  await prisma.availability.delete({ where: { id } })
  return ok({ success: true })
}
