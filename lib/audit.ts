import { prisma } from './db'

interface AuditLogInput {
  actorId: string
  shiftId?: string
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  note?: string
}

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      shiftId: input.shiftId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ? JSON.stringify(input.before) : null,
      after: input.after ? JSON.stringify(input.after) : null,
      note: input.note,
    },
  })
}
