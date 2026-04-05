import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const results: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'SET (' + process.env.TURSO_AUTH_TOKEN.length + ' chars)' : 'NOT SET',
    AUTH_SECRET: process.env.AUTH_SECRET ? 'SET' : 'NOT SET',
    AUTH_URL: process.env.AUTH_URL ?? 'NOT SET',
  }

  try {
    const count = await prisma.user.count()
    results.db = `OK — ${count} users found`
  } catch (e) {
    results.db = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(results)
}
