import { requireAuth, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const take = parseInt(searchParams.get('take') || '50')

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session!.user.id,
      ...(unreadOnly && { isRead: false }),
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: session!.user.id, isRead: false },
  })

  return ok({ notifications, unreadCount })
}

export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { ids, markAllRead } = body

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session!.user.id, isRead: false },
      data: { isRead: true },
    })
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: session!.user.id },
      data: { isRead: true },
    })
  }

  return ok({ success: true })
}
