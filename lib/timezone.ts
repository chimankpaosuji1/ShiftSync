import { format, parseISO, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz'

// Convert a UTC Date to local display string in the given timezone
export function formatInTimezone(date: Date | string, timezone: string, fmt = 'MMM d, yyyy h:mm a'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatTz(d, fmt, { timeZone: timezone })
}

// Get a date in a specific timezone as a Date object
export function toLocalDate(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(d, timezone)
}

// Convert a local date+time string ("2024-01-15 14:00") in a given timezone to UTC Date
export function localToUtc(localDateTimeStr: string, timezone: string): Date {
  return fromZonedTime(localDateTimeStr, timezone)
}

// Get current time in a timezone
export function nowInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone)
}

// Format time as HH:MM in a timezone
export function formatTime(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, 'HH:mm')
}

// Format date as YYYY-MM-DD in a timezone
export function formatDate(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, 'yyyy-MM-dd')
}

// Format as day of week + time
export function formatDayTime(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, 'EEE, MMM d h:mm a zzz')
}

// Check if a shift is overnight (endTime < startTime in local TZ)
export function isOvernightShift(startUtc: Date, endUtc: Date): boolean {
  // A shift is overnight if it spans past midnight
  return endUtc < startUtc || differenceInMinutes(endUtc, startUtc) > 12 * 60
}

// Get week bounds (Mon-Sun) for a given date in UTC
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // adjust to Monday
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() + diff)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

// Parse "HH:MM" string to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

// Check if a UTC time falls within an availability window (in the user's local timezone)
// availability is defined as dayOfWeek + startTime + endTime in local time
export function isWithinAvailability(
  shiftStartUtc: Date,
  shiftEndUtc: Date,
  availabilityStartHHMM: string,
  availabilityEndHHMM: string,
  availabilityDayOfWeek: number | null,
  userTimezone: string // We use the location timezone for availability matching
): boolean {
  // Convert shift times to local timezone for comparison
  const shiftStartLocal = toZonedTime(shiftStartUtc, userTimezone)
  const shiftEndLocal = toZonedTime(shiftEndUtc, userTimezone)

  const shiftDayOfWeek = shiftStartLocal.getDay()

  if (availabilityDayOfWeek !== null && availabilityDayOfWeek !== shiftDayOfWeek) {
    return false
  }

  const availStart = timeToMinutes(availabilityStartHHMM)
  let availEnd = timeToMinutes(availabilityEndHHMM)
  const shiftStart = shiftStartLocal.getHours() * 60 + shiftStartLocal.getMinutes()
  let shiftEnd = shiftEndLocal.getHours() * 60 + shiftEndLocal.getMinutes()

  // Normalize overnight shift: if shift end wraps past midnight (e.g. 23:00→03:00),
  // add 1440 so both values are on the same numeric scale
  if (shiftEnd < shiftStart) shiftEnd += 1440

  // Normalize overnight availability window (e.g. 22:00→02:00)
  if (availEnd < availStart) availEnd += 1440

  return shiftStart >= availStart && shiftEnd <= availEnd
}

// Check if a date (YYYY-MM-DD) matches an exception date
export function matchesExceptionDate(utcDate: Date, exceptionDateStr: string, userTimezone: string): boolean {
  const localDate = formatDate(utcDate, userTimezone)
  return localDate === exceptionDateStr
}

// Get day-of-week in a specific timezone for a UTC Date
export function getDayOfWeekInTimezone(utcDate: Date, timezone: string): number {
  return toZonedTime(utcDate, timezone).getDay()
}

// Premium shift: Friday or Saturday evening (5pm-11pm in location timezone)
export function isPremiumShift(startUtc: Date, locationTimezone: string): boolean {
  const localStart = toZonedTime(startUtc, locationTimezone)
  const hour = localStart.getHours()
  const dayOfWeek = localStart.getDay() // 0=Sun, 5=Fri, 6=Sat
  const isEvening = hour >= 17 && hour < 23
  const isFriOrSat = dayOfWeek === 5 || dayOfWeek === 6
  return isEvening && isFriOrSat
}

// Shift duration in hours
export function shiftDurationHours(startUtc: Date, endUtc: Date): number {
  return differenceInMinutes(endUtc, startUtc) / 60
}
