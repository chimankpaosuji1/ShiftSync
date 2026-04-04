import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } })
  return ok(skills)
}

export async function POST(req: Request) {
  const { error } = await requireRole(['ADMIN'])
  if (error) return error

  const body = await req.json()
  const { name, description, color } = body
  if (!name) return err('name required')

  const skill = await prisma.skill.create({ data: { name, description, color: color || '#6366f1' } })
  return ok(skill, 201)
}
