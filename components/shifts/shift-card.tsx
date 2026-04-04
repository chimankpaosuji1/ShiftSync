'use client'
import { Button } from '@/components/ui/button'
import { Clock, MapPin, Users, Star, UserPlus, Pencil, ArrowLeftRight } from 'lucide-react'
import { formatInTimezone } from '@/lib/timezone'
import type { ShiftSummary } from '@/types'

interface ShiftCardProps {
  shift: ShiftSummary
  onAssign?: (shift: ShiftSummary) => void
  onEdit?: (shift: ShiftSummary) => void
  onSwapRequest?: (shift: ShiftSummary) => void
  isManager?: boolean
  currentUserId?: string
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

const avatarColors = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function colorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export function ShiftCard({ shift, onAssign, onEdit, onSwapRequest, isManager, currentUserId }: ShiftCardProps) {
  const startLocal = formatInTimezone(shift.startTime, shift.locationTimezone, 'h:mm a')
  const endLocal = formatInTimezone(shift.endTime, shift.locationTimezone, 'h:mm a')
  const tzAbbr = formatInTimezone(shift.endTime, shift.locationTimezone, 'zzz')
  const filled = shift.assignmentCount
  const needed = shift.headcount
  const isFull = filled >= needed
  const isAssigned = shift.assignments.some((a) => a.userId === currentUserId)
  const isPublished = shift.status === 'PUBLISHED'

  // Card accent based on status
  const cardStyle = isPublished
    ? isFull
      ? 'border-l-emerald-400 bg-white'
      : 'border-l-indigo-400 bg-white'
    : 'border-l-slate-300 bg-slate-50/80'

  return (
    <div className={`rounded-xl border border-l-[3px] shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden ${cardStyle}`}>
      {/* Top section */}
      <div className="px-3 pt-2.5 pb-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="h-2 w-2 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: shift.skillColor || '#6366f1' }}
            />
            <span className="text-[13px] font-semibold text-slate-800 truncate leading-tight">
              {shift.skillName}
            </span>
            {shift.isPremium && (
              <Star className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isPublished ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
              {isPublished ? 'Live' : 'Draft'}
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1 text-slate-600 mb-1.5">
          <Clock className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="text-[12px] font-medium">{startLocal} – {endLocal}</span>
          <span className="text-[11px] text-slate-400">{tzAbbr}</span>
        </div>

        {/* Location + headcount */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{(shift.locationName ?? '').split(' ')[0]}</span>
          </span>
          <span className={`flex items-center gap-1 text-[11px] font-medium ${isFull ? 'text-emerald-600' : filled > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Users className="h-3 w-3" />
            {filled}/{needed}
          </span>
        </div>
      </div>

      {/* Assignments strip */}
      {(shift.assignments.length > 0 || !isFull) && (
        <div className="px-3 pb-2 flex flex-wrap items-center gap-1">
          {shift.assignments.map((a) => {
            const name = a.userName ?? ''
            const isMe = a.userId === currentUserId
            const color = isMe ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : colorForName(name)
            return (
              <span
                key={a.id}
                title={name}
                className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${color} shrink-0`}
              >
                {getInitials(name || '?')}
              </span>
            )
          })}
          {!isFull && needed - filled > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              +{needed - filled} open
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      {(isManager || (!isManager && isAssigned)) && (
        <div className="px-2 pb-2 flex gap-1 justify-end">
          {isManager && onAssign && !isFull && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium"
              onClick={() => onAssign(shift)}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Assign
            </Button>
          )}
          {isManager && onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onEdit(shift)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {!isManager && isAssigned && onSwapRequest && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 text-indigo-600 hover:bg-indigo-50"
              onClick={() => onSwapRequest(shift)}
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Swap
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
