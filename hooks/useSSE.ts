'use client'
import { useEffect, useRef, useCallback } from 'react'
import type { SSEEvent } from '@/types'

type Handler = (event: SSEEvent) => void

export function useSSE(onEvent: Handler) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const eventSource = new EventSource('/api/events')

    eventSource.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data)
        handlerRef.current(event)
      } catch {}
    }

    eventSource.onerror = () => {
      // Auto-reconnects
    }

    return () => eventSource.close()
  }, [])
}
