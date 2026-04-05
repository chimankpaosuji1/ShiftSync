'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/components/layout/user-context'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2 } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  SHIFT_CREATED: 'bg-blue-100 text-blue-700',
  SHIFT_UPDATED: 'bg-yellow-100 text-yellow-700',
  SHIFT_PUBLISHED: 'bg-green-100 text-green-700',
  SHIFT_CANCELLED: 'bg-red-100 text-red-700',
  ASSIGNMENT_ADDED: 'bg-indigo-100 text-indigo-700',
  ASSIGNMENT_REMOVED: 'bg-orange-100 text-orange-700',
  SWAP_REQUESTED: 'bg-purple-100 text-purple-700',
  SWAP_ACCEPTED: 'bg-teal-100 text-teal-700',
  SWAP_APPROVED: 'bg-green-100 text-green-700',
  SWAP_REJECTED: 'bg-red-100 text-red-700',
  SWAP_CANCELLED: 'bg-gray-100 text-gray-700',
  DROP_REQUESTED: 'bg-pink-100 text-pink-700',
}

function buildQs(filterLocation: string, filterStart: string, filterEnd: string, take?: number) {
  const qs = new URLSearchParams()
  if (filterLocation && filterLocation !== 'all') qs.set('locationId', filterLocation)
  if (filterStart) qs.set('start', filterStart)
  if (filterEnd) qs.set('end', filterEnd)
  if (take) qs.set('take', String(take))
  return qs.toString()
}

function escapeCsv(val: unknown): string {
  const s = val == null ? '' : String(val).replace(/"/g, '""')
  return `"${s}"`
}

export default function AuditPage() {
  const { role } = useUser()
  const isAdmin = role === 'ADMIN'

  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  useEffect(() => {
    fetch('/api/locations').then((r) => r.json()).then(setLocations)
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const qs = buildQs(filterLocation, filterStart, filterEnd, 200)
    const data = await fetch(`/api/audit?${qs}`).then((r) => r.json())
    setLogs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterLocation, filterStart, filterEnd])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleExport = async () => {
    setExporting(true)
    try {
      // Fetch all records (no take limit) for export
      const qs = buildQs(filterLocation, filterStart, filterEnd, 10000)
      const data = await fetch(`/api/audit?${qs}`).then((r) => r.json())
      const rows: any[] = Array.isArray(data) ? data : []

      const headers = ['Timestamp', 'Action', 'Actor', 'Actor Email', 'Location', 'Note', 'Shift ID']
      const csvRows = [
        headers.join(','),
        ...rows.map((log) =>
          [
            escapeCsv(new Date(log.createdAt).toISOString()),
            escapeCsv(log.action),
            escapeCsv(log.actor?.name),
            escapeCsv(log.actor?.email),
            escapeCsv(log.shift?.location?.name ?? ''),
            escapeCsv(log.note ?? ''),
            escapeCsv(log.shiftId ?? ''),
          ].join(',')
        ),
      ]

      const csv = csvRows.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const datePart = filterStart && filterEnd
        ? `_${filterStart}_to_${filterEnd}`
        : filterStart
          ? `_from_${filterStart}`
          : filterEnd
            ? `_to_${filterEnd}`
            : ''
      const locPart = filterLocation !== 'all'
        ? `_${locations.find((l) => l.id === filterLocation)?.name.replace(/\s+/g, '-') ?? filterLocation}`
        : ''
      a.download = `audit-log${locPart}${datePart}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Audit Log" />
      <main className="flex-1 p-4 lg:p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-48 bg-white shadow-sm">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-40 bg-white shadow-sm"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            title="From date"
          />
          <Input
            type="date"
            className="w-40 bg-white shadow-sm"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            title="To date"
          />

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto bg-white shadow-sm"
              onClick={handleExport}
              disabled={exporting || loading}
            >
              {exporting
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <Download className="h-4 w-4 mr-1.5" />}
              Export CSV
            </Button>
          )}
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted-foreground mb-3">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            {logs.length === 200 ? ' (showing first 200 — use export for full data)' : ''}
          </p>
        )}

        {/* Log list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading audit log…</div>
        ) : (
          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="text-center py-12 text-muted-foreground">No audit log entries found</p>
            )}
            {logs.map((log) => (
              <Card key={log.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-medium">{log.actor.name}</span>
                        {log.shift?.location && (
                          <Badge variant="outline" className="text-xs">{log.shift.location.name}</Badge>
                        )}
                      </div>
                      {log.note && (
                        <p className="text-xs text-muted-foreground italic mb-1">"{log.note}"</p>
                      )}
                      {log.before && log.after && (
                        <details className="text-xs text-muted-foreground cursor-pointer">
                          <summary className="hover:text-foreground">View changes</summary>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <div className="bg-red-50 p-2 rounded text-xs overflow-auto max-h-20">
                              <p className="font-medium text-red-600 mb-1">Before</p>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(log.before), null, 2).slice(0, 200)}</pre>
                            </div>
                            <div className="bg-green-50 p-2 rounded text-xs overflow-auto max-h-20">
                              <p className="font-medium text-green-600 mb-1">After</p>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(log.after), null, 2).slice(0, 200)}</pre>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
