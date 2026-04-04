/**
 * Server-Sent Events (SSE) Manager
 *
 * Manages SSE connections for real-time updates.
 * Each user can have multiple connections (multiple tabs).
 */

import { SSEEvent } from '@/types'

class SSEManager {
  private connections = new Map<string, Set<ReadableStreamDefaultController>>()

  addConnection(userId: string, controller: ReadableStreamDefaultController) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set())
    }
    this.connections.get(userId)!.add(controller)
  }

  removeConnection(userId: string, controller: ReadableStreamDefaultController) {
    const userConns = this.connections.get(userId)
    if (userConns) {
      userConns.delete(controller)
      if (userConns.size === 0) {
        this.connections.delete(userId)
      }
    }
  }

  sendToUser(userId: string, event: SSEEvent) {
    const userConns = this.connections.get(userId)
    if (!userConns || userConns.size === 0) return

    const data = `data: ${JSON.stringify(event)}\n\n`
    const encoder = new TextEncoder()
    const encoded = encoder.encode(data)

    const deadConnections: ReadableStreamDefaultController[] = []
    for (const controller of userConns) {
      try {
        controller.enqueue(encoded)
      } catch {
        deadConnections.push(controller)
      }
    }
    deadConnections.forEach((c) => userConns.delete(c))
  }

  broadcastToLocation(locationId: string, event: SSEEvent, userIds: string[]) {
    for (const userId of userIds) {
      this.sendToUser(userId, event)
    }
  }

  broadcast(event: SSEEvent, userIds: string[]) {
    for (const userId of userIds) {
      this.sendToUser(userId, event)
    }
  }

  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys())
  }
}

// Global singleton
declare global {
  // eslint-disable-next-line no-var
  var __sseManager: SSEManager | undefined
}

export const sseManager: SSEManager = global.__sseManager ?? new SSEManager()
if (process.env.NODE_ENV !== 'production') {
  global.__sseManager = sseManager
}
