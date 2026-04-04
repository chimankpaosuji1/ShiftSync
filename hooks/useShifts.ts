'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ShiftSummary } from '@/types'

export function useShifts(params: { locationId?: string; weekStart?: string; weekEnd?: string; userId?: string }) {
  const [shifts, setShifts] = useState<ShiftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (params.locationId) qs.set('locationId', params.locationId)
      if (params.weekStart) qs.set('weekStart', params.weekStart)
      if (params.weekEnd) qs.set('weekEnd', params.weekEnd)
      if (params.userId) qs.set('userId', params.userId)
      const r = await fetch(`/api/shifts?${qs}`)
      if (!r.ok) throw new Error('Failed to load shifts')
      const data = await r.json()
      setShifts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [params.locationId, params.weekStart, params.weekEnd, params.userId])

  useEffect(() => { load() }, [load])

  return { shifts, loading, error, refetch: load }
}
