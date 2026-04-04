// Core domain types mirroring Prisma models with computed fields

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF'
export type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
export type AssignmentStatus = 'ACTIVE' | 'DROPPED' | 'SWAPPED' | 'CANCELLED'
export type SwapType = 'SWAP' | 'DROP'
export type SwapStatus = 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type AvailabilityType = 'RECURRING' | 'EXCEPTION'

export interface UserSummary {
  id: string
  email: string
  name: string
  role: Role
  desiredHours: number
  avatarUrl?: string | null
  isActive: boolean
}

export interface UserDetail extends UserSummary {
  skills: { id: string; name: string; color: string }[]
  certifications: { locationId: string; locationName: string }[]
  managedLocations?: { locationId: string; locationName: string }[]
}

export interface LocationSummary {
  id: string
  name: string
  city: string
  state: string
  timezone: string
  isActive: boolean
}

export interface Skill {
  id: string
  name: string
  description?: string | null
  color: string
}

export interface ShiftSummary {
  id: string
  locationId: string
  locationName: string
  locationTimezone: string
  skillId: string
  skillName: string
  skillColor: string
  startTime: string // ISO UTC
  endTime: string   // ISO UTC
  headcount: number
  isPremium: boolean
  status: ShiftStatus
  publishedAt?: string | null
  notes?: string | null
  assignmentCount: number
  assignments: AssignmentSummary[]
}

export interface AssignmentSummary {
  id: string
  shiftId: string
  userId: string
  userName: string
  userEmail: string
  assignedAt: string
  status: AssignmentStatus
}

export interface SwapRequestSummary {
  id: string
  shiftId: string
  shift: ShiftSummary
  requesterId: string
  requesterName: string
  targetUserId?: string | null
  targetUserName?: string | null
  type: SwapType
  status: SwapStatus
  reason?: string | null
  managerNote?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationItem {
  id: string
  userId: string
  type: string
  title: string
  body: string
  isRead: boolean
  data?: Record<string, unknown> | null
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  shiftId?: string | null
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  note?: string | null
  createdAt: string
}

// Constraint violation types
export interface ConstraintViolation {
  type: 'DOUBLE_BOOKING' | 'REST_PERIOD' | 'SKILL_MISMATCH' | 'LOCATION_NOT_CERTIFIED' | 'UNAVAILABLE' | 'OVERTIME_HARD_BLOCK' | 'OVERTIME_WARNING' | 'CONSECUTIVE_DAYS' | 'EDIT_CUTOFF'
  severity: 'ERROR' | 'WARNING'
  message: string
  detail?: string
  suggestion?: string
}

export interface AssignmentCheckResult {
  allowed: boolean
  violations: ConstraintViolation[]
  warnings: ConstraintViolation[]
  suggestedAlternatives?: UserSummary[]
}

// Overtime tracking
export interface OvertimeStatus {
  userId: string
  userName: string
  weeklyHours: number
  dailyHoursMax: number
  consecutiveDays: number
  projectedOvertimeCost: number
  overtimeHours: number
  warnings: string[]
  isHardBlocked: boolean
}

// Fairness analytics
export interface FairnessReport {
  userId: string
  userName: string
  totalHours: number
  premiumShifts: number
  totalShifts: number
  desiredHours: number
  hoursVariance: number // actual - desired
  premiumFairnessScore: number // 0-100
}

// Schedule week view
export interface WeekSchedule {
  weekStart: string // YYYY-MM-DD
  weekEnd: string
  locationId: string
  shifts: ShiftSummary[]
  overtimeWarnings: OvertimeStatus[]
  totalLaborHours: number
  publishedAt?: string | null
}

// SSE event types
export interface SSEEvent {
  type: 'SHIFT_UPDATED' | 'ASSIGNMENT_CHANGED' | 'SWAP_REQUEST' | 'NOTIFICATION' | 'SCHEDULE_PUBLISHED' | 'CONFLICT_ALERT'
  payload: Record<string, unknown>
  timestamp: string
}
