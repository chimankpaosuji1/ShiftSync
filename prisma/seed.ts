/**
 * Seed data for ShiftSync — Coastal Eats
 *
 * Creates realistic test data including:
 * - 4 locations (2 in ET, 2 in PT)
 * - Admin, managers, and staff with varied skills/certifications
 * - Shifts for the current week + some historical data
 * - Some overlap/constraint-testing scenarios
 * - Swap requests in various states
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaLibSql } = require('@prisma/adapter-libsql')
import { hash } from 'bcryptjs'
import { addDays, addHours } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import * as path from 'path'

const dbUrl = process.env.DATABASE_URL ?? `file:///${path.resolve(process.cwd(), 'dev.db').replace(/\\/g, '/')}`
const adapterOptions: Record<string, string> = { url: dbUrl }
if (process.env.TURSO_AUTH_TOKEN) adapterOptions.authToken = process.env.TURSO_AUTH_TOKEN
const adapter = new PrismaLibSql(adapterOptions)
const prisma = new PrismaClient({ adapter })

function localToUtc(date: Date, hour: number, minute: number, timezone: string): Date {
  const localStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  return fromZonedTime(localStr, timezone)
}

async function main() {
  console.log('🌱 Seeding ShiftSync database...')

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  await prisma.auditLog.deleteMany()
  await prisma.swapRequest.deleteMany()
  await prisma.shiftAssignment.deleteMany()
  await prisma.shift.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.availability.deleteMany()
  await prisma.userSkill.deleteMany()
  await prisma.locationCertification.deleteMany()
  await prisma.locationManager.deleteMany()
  await prisma.notificationPreference.deleteMany()
  await prisma.user.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.location.deleteMany()

  // ─── Skills ──────────────────────────────────────────────────────────────
  const skills = await Promise.all([
    prisma.skill.create({ data: { name: 'Server', color: '#6366f1', description: 'Front-of-house serving' } }),
    prisma.skill.create({ data: { name: 'Bartender', color: '#8b5cf6', description: 'Bar service and cocktails' } }),
    prisma.skill.create({ data: { name: 'Host', color: '#06b6d4', description: 'Greeting and seating guests' } }),
    prisma.skill.create({ data: { name: 'Line Cook', color: '#f97316', description: 'Back-of-house cooking' } }),
    prisma.skill.create({ data: { name: 'Prep Cook', color: '#eab308', description: 'Food preparation' } }),
    prisma.skill.create({ data: { name: 'Dishwasher', color: '#64748b', description: 'Kitchen support' } }),
    prisma.skill.create({ data: { name: 'Supervisor', color: '#ec4899', description: 'Floor supervisor duties' } }),
  ])

  const [server, bartender, host, lineCook, prepCook, dishwasher, supervisor] = skills
  console.log('✅ Skills created')

  // ─── Locations ───────────────────────────────────────────────────────────
  const harborView = await prisma.location.create({
    data: {
      name: 'Harbor View Bistro',
      address: '12 Harbor Lane',
      city: 'Boston',
      state: 'MA',
      timezone: 'America/New_York',
    },
  })

  const downtown = await prisma.location.create({
    data: {
      name: 'Downtown Kitchen',
      address: '450 Main Street',
      city: 'New York',
      state: 'NY',
      timezone: 'America/New_York',
    },
  })

  const bayfront = await prisma.location.create({
    data: {
      name: 'Bayfront Grill',
      address: '88 Ocean Blvd',
      city: 'San Francisco',
      state: 'CA',
      timezone: 'America/Los_Angeles',
    },
  })

  const sunset = await prisma.location.create({
    data: {
      name: 'Sunset Terrace',
      address: '200 Pacific Ave',
      city: 'Los Angeles',
      state: 'CA',
      timezone: 'America/Los_Angeles',
    },
  })

  console.log('✅ Locations created (2 ET, 2 PT)')

  // ─── Users ───────────────────────────────────────────────────────────────
  const pw = await hash('password123', 12)

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@coastaleats.com',
      password: pw,
      name: 'Alex Corporate',
      role: 'ADMIN',
      desiredHours: 40,
    },
  })

  // Managers
  const mgr1 = await prisma.user.create({
    data: {
      email: 'manager.harbor@coastaleats.com',
      password: pw,
      name: 'Maria Santos',
      role: 'MANAGER',
      desiredHours: 45,
    },
  })

  const mgr2 = await prisma.user.create({
    data: {
      email: 'manager.downtown@coastaleats.com',
      password: pw,
      name: 'James Chen',
      role: 'MANAGER',
      desiredHours: 45,
    },
  })

  const mgr3 = await prisma.user.create({
    data: {
      email: 'manager.bayfront@coastaleats.com',
      password: pw,
      name: 'Laura Kim',
      role: 'MANAGER',
      desiredHours: 45,
    },
  })

  const mgr4 = await prisma.user.create({
    data: {
      email: 'manager.sunset@coastaleats.com',
      password: pw,
      name: 'David Park',
      role: 'MANAGER',
      desiredHours: 45,
    },
  })

  // Staff — varied skills and certifications
  const staffMembers = await Promise.all([
    prisma.user.create({ data: { email: 'staff.alice@coastaleats.com', password: pw, name: 'Alice Johnson', role: 'STAFF', desiredHours: 35 } }),
    prisma.user.create({ data: { email: 'staff.bob@coastaleats.com', password: pw, name: 'Bob Williams', role: 'STAFF', desiredHours: 40 } }),
    prisma.user.create({ data: { email: 'staff.carol@coastaleats.com', password: pw, name: 'Carol Davis', role: 'STAFF', desiredHours: 30 } }),
    prisma.user.create({ data: { email: 'staff.dan@coastaleats.com', password: pw, name: 'Dan Martinez', role: 'STAFF', desiredHours: 40 } }),
    prisma.user.create({ data: { email: 'staff.eve@coastaleats.com', password: pw, name: 'Eve Thompson', role: 'STAFF', desiredHours: 25 } }),
    prisma.user.create({ data: { email: 'staff.frank@coastaleats.com', password: pw, name: 'Frank Wilson', role: 'STAFF', desiredHours: 40 } }),
    prisma.user.create({ data: { email: 'staff.grace@coastaleats.com', password: pw, name: 'Grace Lee', role: 'STAFF', desiredHours: 32 } }),
    prisma.user.create({ data: { email: 'staff.henry@coastaleats.com', password: pw, name: 'Henry Brown', role: 'STAFF', desiredHours: 40 } }),
    prisma.user.create({ data: { email: 'staff.iris@coastaleats.com', password: pw, name: 'Iris Garcia', role: 'STAFF', desiredHours: 35 } }),
    prisma.user.create({ data: { email: 'staff.jack@coastaleats.com', password: pw, name: 'Jack Anderson', role: 'STAFF', desiredHours: 20 } }),
    prisma.user.create({ data: { email: 'staff.karen@coastaleats.com', password: pw, name: 'Karen White', role: 'STAFF', desiredHours: 38 } }),
    prisma.user.create({ data: { email: 'staff.leo@coastaleats.com', password: pw, name: 'Leo Harris', role: 'STAFF', desiredHours: 40 } }),
  ])

  const [alice, bob, carol, dan, eve, frank, grace, henry, iris, jack, karen, leo] = staffMembers
  console.log('✅ Users created')

  // ─── Location Managers ───────────────────────────────────────────────────
  await prisma.locationManager.createMany({
    data: [
      { userId: mgr1.id, locationId: harborView.id },
      { userId: mgr2.id, locationId: downtown.id },
      { userId: mgr3.id, locationId: bayfront.id },
      { userId: mgr4.id, locationId: sunset.id },
      // Admin manages all implicitly, but add to one for demo
      { userId: admin.id, locationId: harborView.id },
    ],
  })

  // ─── Skills Assignments ──────────────────────────────────────────────────
  const skillAssignments = [
    // Alice: server + bartender (certified ET locations — key test: multi-location)
    { userId: alice.id, skillId: server.id },
    { userId: alice.id, skillId: bartender.id },
    // Bob: server + host
    { userId: bob.id, skillId: server.id },
    { userId: bob.id, skillId: host.id },
    // Carol: host only
    { userId: carol.id, skillId: host.id },
    // Dan: line cook + prep cook (key test: overtime scenario)
    { userId: dan.id, skillId: lineCook.id },
    { userId: dan.id, skillId: prepCook.id },
    // Eve: server (part-time, limited availability)
    { userId: eve.id, skillId: server.id },
    // Frank: bartender + supervisor
    { userId: frank.id, skillId: bartender.id },
    { userId: frank.id, skillId: supervisor.id },
    // Grace: server + host (PT certified)
    { userId: grace.id, skillId: server.id },
    { userId: grace.id, skillId: host.id },
    // Henry: line cook
    { userId: henry.id, skillId: lineCook.id },
    { userId: henry.id, skillId: prepCook.id },
    { userId: henry.id, skillId: dishwasher.id },
    // Iris: server + bartender (certified PT — key test: cross-TZ staff)
    { userId: iris.id, skillId: server.id },
    { userId: iris.id, skillId: bartender.id },
    // Jack: dishwasher (part-time)
    { userId: jack.id, skillId: dishwasher.id },
    // Karen: server + supervisor
    { userId: karen.id, skillId: server.id },
    { userId: karen.id, skillId: supervisor.id },
    // Leo: bartender + supervisor
    { userId: leo.id, skillId: bartender.id },
    { userId: leo.id, skillId: supervisor.id },
  ]
  await prisma.userSkill.createMany({ data: skillAssignments })

  // ─── Location Certifications ─────────────────────────────────────────────
  const certifications = [
    // ET locations staff
    { userId: alice.id, locationId: harborView.id },
    { userId: alice.id, locationId: downtown.id }, // Alice certified at both ET locations (multi-loc test)
    { userId: bob.id, locationId: harborView.id },
    { userId: carol.id, locationId: harborView.id },
    { userId: dan.id, locationId: harborView.id },
    { userId: dan.id, locationId: downtown.id },
    { userId: eve.id, locationId: downtown.id },
    { userId: frank.id, locationId: downtown.id },
    { userId: frank.id, locationId: harborView.id },
    { userId: karen.id, locationId: harborView.id },
    { userId: karen.id, locationId: downtown.id },
    // PT locations staff
    { userId: grace.id, locationId: bayfront.id },
    { userId: grace.id, locationId: sunset.id }, // Grace certified at both PT (like Alice for PT)
    { userId: henry.id, locationId: bayfront.id },
    { userId: iris.id, locationId: bayfront.id },
    { userId: iris.id, locationId: sunset.id }, // Iris: cross-TZ test — certified at PT but sets availability in ET??
    { userId: jack.id, locationId: bayfront.id },
    { userId: jack.id, locationId: sunset.id },
    { userId: leo.id, locationId: sunset.id },
    { userId: leo.id, locationId: bayfront.id },
    // Cross-TZ: Alice is also certified at Bayfront (timezone complexity)
    { userId: alice.id, locationId: bayfront.id },
  ]
  await prisma.locationCertification.createMany({ data: certifications })
  console.log('✅ Certifications and skills assigned')

  // ─── Availability ────────────────────────────────────────────────────────
  // Recurring availability (0=Sun, 1=Mon ... 6=Sat)
  const availabilityData: any[] = []

  // Alice: available Mon-Fri 9am-11pm, Saturday 5pm-close
  for (let d = 1; d <= 5; d++) {
    availabilityData.push({ userId: alice.id, type: 'RECURRING', dayOfWeek: d, startTime: '09:00', endTime: '23:00', isAvailable: true })
  }
  availabilityData.push({ userId: alice.id, type: 'RECURRING', dayOfWeek: 6, startTime: '17:00', endTime: '23:30', isAvailable: true })

  // Bob: available 7 days, 10am-10pm
  for (let d = 0; d <= 6; d++) {
    availabilityData.push({ userId: bob.id, type: 'RECURRING', dayOfWeek: d, startTime: '10:00', endTime: '22:00', isAvailable: true })
  }

  // Carol: Mon/Wed/Fri only, 11am-7pm
  for (const d of [1, 3, 5]) {
    availabilityData.push({ userId: carol.id, type: 'RECURRING', dayOfWeek: d, startTime: '11:00', endTime: '19:00', isAvailable: true })
  }

  // Dan: Mon-Sat 8am-4pm (morning cook — overtime scenario: he's already near 40h)
  for (let d = 1; d <= 6; d++) {
    availabilityData.push({ userId: dan.id, type: 'RECURRING', dayOfWeek: d, startTime: '08:00', endTime: '16:00', isAvailable: true })
  }

  // Eve: Tue/Thu/Sat 12pm-8pm (limited hours, call-out scenario)
  for (const d of [2, 4, 6]) {
    availabilityData.push({ userId: eve.id, type: 'RECURRING', dayOfWeek: d, startTime: '12:00', endTime: '20:00', isAvailable: true })
  }
  // Eve has a one-off block today (for Sunday Night Chaos scenario)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  availabilityData.push({
    userId: eve.id, type: 'EXCEPTION', date: todayStr,
    startTime: '00:00', endTime: '23:59', isAvailable: false,
    note: 'Called out sick'
  })

  // Frank: Wed-Sun 4pm-close
  for (const d of [0, 3, 4, 5, 6]) {
    availabilityData.push({ userId: frank.id, type: 'RECURRING', dayOfWeek: d, startTime: '16:00', endTime: '23:59', isAvailable: true })
  }

  // Grace: 7 days, 9am-5pm (PT timezone reference)
  for (let d = 0; d <= 6; d++) {
    availabilityData.push({ userId: grace.id, type: 'RECURRING', dayOfWeek: d, startTime: '09:00', endTime: '17:00', isAvailable: true })
  }

  // Henry: Mon-Fri 6am-2pm
  for (let d = 1; d <= 5; d++) {
    availabilityData.push({ userId: henry.id, type: 'RECURRING', dayOfWeek: d, startTime: '06:00', endTime: '14:00', isAvailable: true })
  }

  // Iris: all days 11am-11pm
  for (let d = 0; d <= 6; d++) {
    availabilityData.push({ userId: iris.id, type: 'RECURRING', dayOfWeek: d, startTime: '11:00', endTime: '23:00', isAvailable: true })
  }

  // Jack: weekends only
  for (const d of [0, 6]) {
    availabilityData.push({ userId: jack.id, type: 'RECURRING', dayOfWeek: d, startTime: '10:00', endTime: '22:00', isAvailable: true })
  }

  // Karen: Mon-Sat 11am-11pm
  for (let d = 1; d <= 6; d++) {
    availabilityData.push({ userId: karen.id, type: 'RECURRING', dayOfWeek: d, startTime: '11:00', endTime: '23:00', isAvailable: true })
  }

  // Leo: 7 days, 3pm-close
  for (let d = 0; d <= 6; d++) {
    availabilityData.push({ userId: leo.id, type: 'RECURRING', dayOfWeek: d, startTime: '15:00', endTime: '23:59', isAvailable: true })
  }

  await prisma.availability.createMany({ data: availabilityData })
  console.log('✅ Availability set')

  // ─── Shifts ──────────────────────────────────────────────────────────────
  // Get Mon of current week
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setUTCHours(0, 0, 0, 0)

  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  // Helper to create shift
  const makeShift = async (
    locationId: string,
    timezone: string,
    skillId: string,
    dayIndex: number, // 0=Mon
    startHour: number,
    endHour: number,
    headcount: number,
    status: string,
    assignUserIds: string[] = []
  ) => {
    const day = week[dayIndex]
    const startUtc = localToUtc(day, startHour, 0, timezone)
    const endUtc = localToUtc(day, endHour, 0, timezone)

    // Auto-detect premium (Fri=index 4, Sat=index 5, evening 17-23)
    const isFriOrSat = dayIndex === 4 || dayIndex === 5
    const isEvening = startHour >= 17 && startHour < 23
    const isPremium = isFriOrSat && isEvening

    const shift = await prisma.shift.create({
      data: {
        locationId,
        skillId,
        startTime: startUtc,
        endTime: endUtc,
        headcount,
        isPremium,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        createdBy: mgr1.id,
      },
    })

    for (const userId of assignUserIds) {
      await prisma.shiftAssignment.create({
        data: { shiftId: shift.id, userId, assignedBy: mgr1.id, status: 'ACTIVE' },
      })
    }

    return shift
  }

  // Harbor View (ET) — current week shifts
  // Monday
  const hvMon1 = await makeShift(harborView.id, 'America/New_York', server.id, 0, 11, 15, 2, 'PUBLISHED', [alice.id, bob.id])
  const hvMon2 = await makeShift(harborView.id, 'America/New_York', lineCook.id, 0, 10, 18, 1, 'PUBLISHED', [dan.id])
  const hvMon3 = await makeShift(harborView.id, 'America/New_York', host.id, 0, 11, 16, 1, 'PUBLISHED', [carol.id])
  // Tuesday
  const hvTue1 = await makeShift(harborView.id, 'America/New_York', server.id, 1, 11, 15, 2, 'PUBLISHED', [alice.id])
  const hvTue2 = await makeShift(harborView.id, 'America/New_York', bartender.id, 1, 17, 23, 1, 'PUBLISHED', [frank.id])
  // Wednesday
  const hvWed1 = await makeShift(harborView.id, 'America/New_York', server.id, 2, 11, 19, 2, 'PUBLISHED', [bob.id, karen.id])
  const hvWed2 = await makeShift(harborView.id, 'America/New_York', lineCook.id, 2, 10, 18, 1, 'PUBLISHED', [dan.id])
  // Thursday
  const hvThu1 = await makeShift(harborView.id, 'America/New_York', server.id, 3, 11, 19, 2, 'PUBLISHED', [alice.id, bob.id])
  const hvThu2 = await makeShift(harborView.id, 'America/New_York', lineCook.id, 3, 10, 18, 1, 'PUBLISHED', [dan.id])
  // Friday EVENING (PREMIUM)
  const hvFri1 = await makeShift(harborView.id, 'America/New_York', server.id, 4, 17, 23, 3, 'PUBLISHED', [alice.id, bob.id, karen.id])
  const hvFri2 = await makeShift(harborView.id, 'America/New_York', bartender.id, 4, 17, 23, 1, 'PUBLISHED', [frank.id])
  const hvFri3 = await makeShift(harborView.id, 'America/New_York', supervisor.id, 4, 17, 23, 1, 'PUBLISHED', [])
  // Saturday EVENING (PREMIUM)
  const hvSat1 = await makeShift(harborView.id, 'America/New_York', server.id, 5, 17, 23, 3, 'PUBLISHED', [alice.id, karen.id])
  const hvSat2 = await makeShift(harborView.id, 'America/New_York', bartender.id, 5, 17, 23, 1, 'PUBLISHED', [frank.id])
  // Sunday (today typically = index 6, but could vary)
  // Eve was assigned Sunday evening but called out
  const hvSun1 = await makeShift(harborView.id, 'America/New_York', server.id, 6, 19, 23, 2, 'PUBLISHED', [eve.id]) // Eve called out — swap needed!
  const hvSun2 = await makeShift(harborView.id, 'America/New_York', bartender.id, 6, 19, 23, 1, 'PUBLISHED', [])

  // Downtown Kitchen (ET) — some shifts
  const dtMon1 = await makeShift(downtown.id, 'America/New_York', server.id, 0, 12, 20, 2, 'PUBLISHED', [])
  const dtWed1 = await makeShift(downtown.id, 'America/New_York', bartender.id, 2, 17, 23, 1, 'DRAFT', [])
  const dtFri1 = await makeShift(downtown.id, 'America/New_York', server.id, 4, 17, 23, 3, 'PUBLISHED', [dan.id]) // Dan also works Downtown Fri — overtime!
  const dtSat1 = await makeShift(downtown.id, 'America/New_York', server.id, 5, 17, 23, 2, 'DRAFT', [])

  // Bayfront Grill (PT)
  const bfMon1 = await makeShift(bayfront.id, 'America/Los_Angeles', server.id, 0, 11, 19, 2, 'PUBLISHED', [grace.id, iris.id])
  const bfWed1 = await makeShift(bayfront.id, 'America/Los_Angeles', lineCook.id, 2, 10, 18, 1, 'PUBLISHED', [henry.id])
  const bfFri1 = await makeShift(bayfront.id, 'America/Los_Angeles', server.id, 4, 17, 23, 2, 'PUBLISHED', [grace.id])
  const bfFri2 = await makeShift(bayfront.id, 'America/Los_Angeles', bartender.id, 4, 17, 23, 1, 'PUBLISHED', [iris.id])
  const bfSat1 = await makeShift(bayfront.id, 'America/Los_Angeles', server.id, 5, 17, 23, 2, 'PUBLISHED', [grace.id, iris.id]) // Premium
  const bfSat2 = await makeShift(bayfront.id, 'America/Los_Angeles', dishwasher.id, 5, 16, 22, 1, 'PUBLISHED', [jack.id])

  // Sunset Terrace (PT)
  const stFri1 = await makeShift(sunset.id, 'America/Los_Angeles', bartender.id, 4, 17, 23, 1, 'PUBLISHED', [leo.id]) // Premium
  const stSat1 = await makeShift(sunset.id, 'America/Los_Angeles', server.id, 5, 17, 23, 2, 'PUBLISHED', []) // Premium, understaffed
  const stSat2 = await makeShift(sunset.id, 'America/Los_Angeles', supervisor.id, 5, 17, 23, 1, 'DRAFT', [])

  // Historical shifts for analytics (last 2 weeks)
  for (let w = 1; w <= 2; w++) {
    const histMonday = addDays(monday, -7 * w)
    const histWeek = Array.from({ length: 7 }, (_, i) => addDays(histMonday, i))

    // Harbor View history
    for (let d = 0; d < 6; d++) {
      const day = histWeek[d]
      const sUtc = localToUtc(day, 11, 0, 'America/New_York')
      const eUtc = localToUtc(day, 19, 0, 'America/New_York')
      const isFriSat = d === 4 || d === 5
      const isPremium = isFriSat

      const hShift = await prisma.shift.create({
        data: {
          locationId: harborView.id,
          skillId: server.id,
          startTime: sUtc,
          endTime: eUtc,
          headcount: 2,
          isPremium,
          status: 'PUBLISHED',
          publishedAt: addDays(sUtc, -3),
          createdBy: mgr1.id,
        },
      })

      // Distribute premium shifts unevenly for fairness analytics testing
      // Alice gets more Saturday premiums, Bob gets more Friday
      const assignees = isFriSat
        ? d === 5 ? [alice.id, karen.id] : [bob.id, karen.id]
        : [alice.id, bob.id]

      for (const uid of assignees) {
        await prisma.shiftAssignment.create({
          data: { shiftId: hShift.id, userId: uid, assignedBy: mgr1.id, status: 'ACTIVE' },
        })
      }
    }
  }

  console.log('✅ Shifts created')

  // ─── Swap Requests ───────────────────────────────────────────────────────
  // 1. Eve dropping her Sunday shift (the callout scenario)
  const drop1 = await prisma.swapRequest.create({
    data: {
      shiftId: hvSun1.id,
      requesterId: eve.id,
      type: 'DROP',
      status: 'PENDING',
      reason: 'I called out sick — need coverage urgently!',
      expiresAt: addHours(week[6], 19), // expires 1hr before shift
    },
  })

  // Notify managers
  await prisma.notification.create({
    data: {
      userId: mgr1.id,
      type: 'DROP_REQUEST',
      title: 'Urgent: Drop Request Needs Coverage',
      body: 'Eve Thompson has dropped their Sunday 7pm server shift at Harbor View. Needs immediate coverage.',
      data: JSON.stringify({ swapRequestId: drop1.id }),
    },
  })

  // 2. Alice requesting swap with Bob (Fri premium shift)
  const swap1 = await prisma.swapRequest.create({
    data: {
      shiftId: hvFri1.id,
      requesterId: alice.id,
      targetUserId: bob.id,
      type: 'SWAP',
      status: 'PENDING',
      reason: 'Family event that evening',
    },
  })

  await prisma.notification.create({
    data: {
      userId: bob.id,
      type: 'SWAP_REQUEST_RECEIVED',
      title: 'Swap Request from Alice',
      body: 'Alice Johnson wants to swap their Friday evening shift with you at Harbor View.',
      data: JSON.stringify({ swapRequestId: swap1.id }),
    },
  })

  // 3. Bob has already accepted a swap (accepted state — awaiting manager)
  const swap2 = await prisma.swapRequest.create({
    data: {
      shiftId: hvSat1.id,
      requesterId: karen.id,
      targetUserId: alice.id,
      type: 'SWAP',
      status: 'ACCEPTED',
      reason: 'Saturday plans',
      managerNote: null,
    },
  })

  await prisma.notification.create({
    data: {
      userId: mgr1.id,
      type: 'SWAP_REQUEST_RECEIVED',
      title: 'Swap Needs Approval: Karen ↔ Alice (Sat Eve)',
      body: 'Karen White and Alice Johnson have agreed to swap Saturday evening shifts. Awaiting your approval.',
      data: JSON.stringify({ swapRequestId: swap2.id }),
    },
  })

  // 4. Approved swap (historical)
  const swap3 = await prisma.swapRequest.create({
    data: {
      shiftId: dtMon1.id,
      requesterId: dan.id,
      targetUserId: alice.id,
      type: 'SWAP',
      status: 'APPROVED',
      reason: 'Had a conflict',
      approverId: mgr2.id,
      managerNote: 'Approved — both are qualified',
    },
  })

  console.log('✅ Swap requests created')

  // ─── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: alice.id,
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule Published',
        body: 'The Harbor View schedule for this week is now available.',
        data: JSON.stringify({ locationId: harborView.id }),
      },
      {
        userId: alice.id,
        type: 'SHIFT_ASSIGNED',
        title: 'New Shift Assigned',
        body: 'You have been assigned to a bartender shift at Harbor View on Friday evening.',
        data: JSON.stringify({ shiftId: hvFri2.id }),
      },
      {
        userId: dan.id,
        type: 'OVERTIME_WARNING',
        title: '⚠️ Overtime Warning',
        body: 'You are projected to work 44 hours this week — 4 hours over the 40h threshold. Your manager has been notified.',
        isRead: false,
      },
      {
        userId: bob.id,
        type: 'SWAP_REQUEST_RECEIVED',
        title: 'Swap Request',
        body: 'Alice Johnson wants to swap a Friday evening shift with you.',
        data: JSON.stringify({ swapRequestId: swap1.id }),
        isRead: false,
      },
    ],
  })

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: mgr1.id,
        shiftId: hvFri1.id,
        action: 'SHIFT_CREATED',
        entityType: 'SHIFT',
        entityId: hvFri1.id,
      },
      {
        actorId: mgr1.id,
        shiftId: hvFri1.id,
        action: 'SHIFT_PUBLISHED',
        entityType: 'SHIFT',
        entityId: hvFri1.id,
      },
      {
        actorId: mgr1.id,
        shiftId: hvFri1.id,
        action: 'ASSIGNMENT_ADDED',
        entityType: 'ASSIGNMENT',
        entityId: 'seed-assignment-1',
        after: JSON.stringify({ userId: alice.id, shiftId: hvFri1.id }),
      },
      {
        actorId: mgr2.id,
        shiftId: swap3.shiftId,
        action: 'SWAP_APPROVED',
        entityType: 'SWAP',
        entityId: swap3.id,
        note: 'Approved — both are qualified',
      },
    ],
  })

  console.log('✅ Audit logs created')
  console.log('')
  console.log('🎉 Seed complete! Demo accounts:')
  console.log('   Admin:    admin@coastaleats.com / password123')
  console.log('   Manager (Harbor View, ET): manager.harbor@coastaleats.com / password123')
  console.log('   Manager (Downtown, ET):    manager.downtown@coastaleats.com / password123')
  console.log('   Manager (Bayfront, PT):    manager.bayfront@coastaleats.com / password123')
  console.log('   Manager (Sunset, PT):      manager.sunset@coastaleats.com / password123')
  console.log('   Staff (Alice - multi-loc): staff.alice@coastaleats.com / password123')
  console.log('   Staff (Dan - OT warning):  staff.dan@coastaleats.com / password123')
  console.log('   Staff (Eve - called out):  staff.eve@coastaleats.com / password123')
  console.log('')
  console.log('🧪 Test scenarios seeded:')
  console.log('   1. Sunday Night Chaos: Eve has called out — drop request pending')
  console.log('   2. Overtime Trap: Dan is projected for 44h (works Harbor + Downtown Fri)')
  console.log('   3. Timezone Tangle: Alice certified at Harbor (ET) and Bayfront (PT)')
  console.log('   4. Fairness Complaint: Check Analytics > Fairness for premium distribution')
  console.log('   5. Pending Swap: Karen ↔ Alice Sat evening swap awaiting manager approval')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
