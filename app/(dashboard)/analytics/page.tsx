'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { AlertTriangle, Star, TrendingUp, TrendingDown } from 'lucide-react'
import type { FairnessReport, OvertimeStatus } from '@/types'

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']

export default function AnalyticsPage() {
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [fairnessData, setFairnessData] = useState<FairnessReport[]>([])
  const [overtimeData, setOvertimeData] = useState<{ totalOvertimeCost: number; staffAtRisk: OvertimeStatus[] } | null>(null)
  const [onDutyData, setOnDutyData] = useState<unknown[]>([])
  const [hoursData, setHoursData] = useState<{ userId: string; userName: string; hours: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/locations').then((r) => r.json()).then((locs) => {
      setLocations(locs)
      if (locs.length > 0) setSelectedLocation(locs[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedLocation) return
    setLoading(true)
    Promise.all([
      fetch(`/api/analytics?type=fairness&locationId=${selectedLocation}`).then((r) => r.json()),
      fetch(`/api/analytics?type=overtime&locationId=${selectedLocation}`).then((r) => r.json()),
      fetch(`/api/analytics?type=on-duty`).then((r) => r.json()),
      fetch(`/api/analytics?type=hours-distribution&locationId=${selectedLocation}`).then((r) => r.json()),
    ]).then(([fairness, overtime, onDuty, hours]) => {
      setFairnessData(Array.isArray(fairness) ? fairness : [])
      setOvertimeData(overtime)
      setOnDutyData(Array.isArray(onDuty) ? onDuty : [])
      setHoursData(Array.isArray(hours) ? hours : [])
    }).finally(() => setLoading(false))
  }, [selectedLocation])

  const premiumData = fairnessData.map((r) => ({
    name: r.userName.split(' ')[0],
    premium: r.premiumShifts,
    regular: r.totalShifts - r.premiumShifts,
  }))

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Analytics" />
      <main className="flex-1 p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
        </div>

        <Tabs defaultValue="fairness">
          <TabsList className="mb-6">
            <TabsTrigger value="fairness">Fairness</TabsTrigger>
            <TabsTrigger value="overtime">Overtime</TabsTrigger>
            <TabsTrigger value="hours">Hours Distribution</TabsTrigger>
            <TabsTrigger value="onduty">On Duty Now</TabsTrigger>
          </TabsList>

          <TabsContent value="fairness" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Premium Shift Distribution
                  </CardTitle>
                  <CardDescription>Friday/Saturday evening shifts (premium) vs regular</CardDescription>
                </CardHeader>
                <CardContent>
                  {premiumData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={premiumData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="premium" stackId="a" fill="#eab308" name="Premium" />
                        <Bar dataKey="regular" stackId="a" fill="#6366f1" name="Regular" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fairness Scores</CardTitle>
                  <CardDescription>How equitably are premium shifts distributed?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {fairnessData.map((r) => (
                      <div key={r.userId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{r.userName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">{r.premiumShifts} premium / {r.totalShifts} total</span>
                            <Badge variant={r.premiumFairnessScore >= 80 ? 'success' : r.premiumFairnessScore >= 50 ? 'warning' : 'destructive'}>
                              {r.premiumFairnessScore}/100
                            </Badge>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.premiumFairnessScore >= 80 ? 'bg-green-500' : r.premiumFairnessScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${r.premiumFairnessScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {fairnessData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data available</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hours vs Desired Hours</CardTitle>
                <CardDescription>Comparing actual scheduled hours against each staff member's desired weekly hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fairnessData.map((r) => (
                    <div key={r.userId} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <span className="text-sm font-medium w-32 truncate">{r.userName}</span>
                      <div className="flex-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.hoursVariance > 10 ? 'bg-red-400' : r.hoursVariance < -10 ? 'bg-blue-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(100, (r.totalHours / Math.max(r.desiredHours, 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground w-28">
                        <span className={r.hoursVariance > 0 ? 'text-red-600' : r.hoursVariance < 0 ? 'text-blue-600' : 'text-green-600'}>
                          {r.totalHours.toFixed(1)}h
                        </span>
                        {' / '}
                        {r.desiredHours.toFixed(0)}h desired
                        {r.hoursVariance > 0 ? (
                          <span className="text-red-500 ml-1 flex items-center justify-end gap-0.5">
                            <TrendingUp className="h-3 w-3" />+{r.hoursVariance.toFixed(1)}h
                          </span>
                        ) : r.hoursVariance < 0 ? (
                          <span className="text-blue-500 ml-1 flex items-center justify-end gap-0.5">
                            <TrendingDown className="h-3 w-3" />{r.hoursVariance.toFixed(1)}h
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {fairnessData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overtime" className="space-y-6">
            {overtimeData && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">${overtimeData.totalOvertimeCost.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Projected Overtime Cost This Week</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">{overtimeData.staffAtRisk.length}</p>
                      <p className="text-xs text-muted-foreground">Staff at/near Overtime</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Staff at Overtime Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overtimeData.staffAtRisk.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No overtime risks this week</p>
                    ) : (
                      <div className="space-y-3">
                        {overtimeData.staffAtRisk.map((s) => (
                          <div key={s.userId} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{s.userName}</span>
                              <div className="flex gap-1.5">
                                {s.isHardBlocked && <Badge variant="destructive" className="text-xs">12h Exceeded</Badge>}
                                {s.overtimeHours > 0 && <Badge variant="warning" className="text-xs">{s.overtimeHours.toFixed(1)}h OT</Badge>}
                                {s.weeklyHours >= 35 && !s.overtimeHours && <Badge variant="warning" className="text-xs">Near OT</Badge>}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>Weekly: {s.weeklyHours.toFixed(1)}h | Daily max: {s.dailyHoursMax.toFixed(1)}h | {s.consecutiveDays} consecutive days</p>
                              {s.projectedOvertimeCost > 0 && <p className="text-orange-600">Est. overtime cost: ${s.projectedOvertimeCost.toFixed(0)}</p>}
                              {s.warnings.map((w, i) => <p key={i} className="text-orange-600">⚠ {w}</p>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hours Distribution (Last 28 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {hoursData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hoursData.slice(0, 15).map((d) => ({ name: d.userName.split(' ')[0], hours: parseFloat(d.hours.toFixed(1)) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="onduty">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  On Duty Right Now
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {onDutyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active shifts right now</p>
                ) : (
                  <div className="space-y-2">
                    {(onDutyData as any[]).map((a, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{a.user.name}</p>
                          <p className="text-xs text-muted-foreground">{a.shift.location.name} · {a.shift.skill.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Until {new Date(a.shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
