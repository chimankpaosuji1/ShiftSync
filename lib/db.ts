import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  // DATABASE_URL must be set; for local SQLite provide absolute file:/// URL
  const url = process.env.DATABASE_URL ?? 'file:///dev.db'
  // Already absolute or remote
  if (url.startsWith('libsql://') || url.startsWith('file:///')) return url
  // Relative file: path — caller must set absolute path in DATABASE_URL
  if (url.startsWith('file:')) return url
  return url
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: getDbUrl() })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  } as ConstructorParameters<typeof PrismaClient>[0])
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
