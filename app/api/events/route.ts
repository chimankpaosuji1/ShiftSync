import { auth } from '@/lib/auth'
import { sseManager } from '@/lib/sse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  const stream = new ReadableStream({
    start(controller) {
      // Register this connection
      sseManager.addConnection(userId, controller)

      // Send initial ping
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { userId }, timestamp: new Date().toISOString() })}\n\n`))

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Clean up on disconnect
      return () => {
        clearInterval(heartbeat)
        sseManager.removeConnection(userId, controller)
      }
    },
    cancel() {
      // Connection closed by client
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
