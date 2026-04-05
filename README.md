# ShiftSync — Multi-Location Staff Scheduling Platform

**Coastal Eats** scheduling platform for 4 locations across 2 time zones.

---

## Quick Start

```bash
npm install
npm run build          # verify build is clean
npm run dev            # start dev server at http://localhost:3000
```

The database is pre-seeded. No additional setup needed.

---

## Demo Login Accounts

All accounts use password: **`password123`**

| Role | Email | Notes |
|------|-------|-------|
| **Admin** | `admin@coastaleats.com` | Full access, all locations |
| **Manager (Harbor View, Boston ET)** | `manager.harbor@coastaleats.com` | Manages ET flagship |
| **Manager (Downtown Kitchen, NYC ET)** | `manager.downtown@coastaleats.com` | Manages ET second location |
| **Manager (Bayfront Grill, SF PT)** | `manager.bayfront@coastaleats.com` | Manages PT flagship |
| **Manager (Sunset Terrace, LA PT)** | `manager.sunset@coastaleats.com` | Manages PT second location |
| **Staff – Alice Johnson** | `staff.alice@coastaleats.com` | Multi-location (ET + PT certified), bartender + server |
| **Staff – Dan Martinez** | `staff.dan@coastaleats.com` | Overtime scenario — projected at 44h this week |
| **Staff – Eve Thompson** | `staff.eve@coastaleats.com` | Called out Sunday — pending DROP request |
| **Staff – Bob Williams** | `staff.bob@coastaleats.com` | Has pending swap request from Alice |

---

## Pre-Seeded Test Scenarios

### 1. The Sunday Night Chaos
Eve Thompson has a drop request pending on her Sunday 7pm server shift at Harbor View. Log in as **manager.harbor** → Swaps & Coverage → approve or find a replacement.

### 2. The Overtime Trap
Dan Martinez is assigned to Harbor View Mon–Thu + Downtown Kitchen Friday, putting him at ~44h for the week. Log in as **admin** → Analytics → Overtime to see the projected cost and which assignment creates the overrun.

### 3. The Timezone Tangle
Alice Johnson is certified at Harbor View (ET) and Bayfront Grill (PT). Her availability is set in her local time. When assigned to a PT shift, the system converts correctly. Log in as **admin** → Schedule → switch between locations to observe.

### 4. The Simultaneous Assignment *(manually test)*
Open two browser tabs, log in as two different managers. Both attempt to assign the same bartender (Frank Wilson) to overlapping shifts at the same time. The second attempt receives a constraint violation.

### 5. The Fairness Complaint
Log in as **manager.harbor** → Analytics → Fairness. Alice and Karen receive Saturday premium shifts more often than Bob. The fairness score and premium shift distribution chart show the disparity.

### 6. The Regret Swap
Alice has a pending SWAP request with Bob for Friday evening. Log in as **staff.alice** → Swaps & Coverage → cancel the request before Bob accepts. The original assignment remains in place automatically.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript |
| Database | Turso (libsql) via Prisma 7 + libsql adapter |
| Auth | NextAuth v5 (JWT, credentials) |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Charts | Recharts |
| Real-time | Server-Sent Events (SSE) via `/api/events` |
| Timezones | date-fns-tz |

---

## Constraint Enforcement

All scheduling rules live in `lib/constraints.ts`.

| Constraint | Severity | Behavior |
|-----------|----------|---------|
| Double-booking | ERROR | Blocks — same person, overlapping times, across all locations |
| 10-hour rest period | ERROR | Blocks — minimum gap between consecutive shifts |
| Skill mismatch | ERROR | Blocks |
| Location not certified | ERROR | Blocks |
| Staff unavailable | ERROR | Blocks — must fall within availability window |
| Daily hours > 12h | ERROR | Hard block |
| Daily hours > 8h | WARNING | Allows with warning |
| Weekly hours ≥ 35h | WARNING | Approaching overtime |
| Weekly hours > 40h | WARNING | Overtime — cost impact shown |
| 6th/7th consecutive day | WARNING | Labor law advisory; 7th requires override |
| Edit cutoff (48h) | ERROR | Published shifts locked within 48h of start |

When blocked, the system explains which rule was broken, shows specifics, and suggests qualified alternatives.

---

## Design Decisions (Intentional Ambiguities)

**De-certification:** Historical assignments preserved. New assignments blocked.

**Desired hours vs. availability:** Desired hours is a fairness-analytics target only — not an assignment constraint. Availability windows are hard constraints.

**Consecutive days:** Any shift length (even 1 hour) counts as a worked day.

**Swap after approval, shift edited:** Swap stays approved; new assignee gets a SHIFT_CHANGED notification. Pending swaps are auto-cancelled if shift times/skill change.

**Availability timezone:** Staff availability is matched against the *location's* timezone. A 9am–5pm window for Alice at Bayfront (PT) is checked in PT.

**Overnight shifts:** Stored as single shifts spanning midnight. Duration calculated correctly across the boundary.

**Premium shifts:** Friday/Saturday 5pm–11pm in the location's local timezone. Auto-tagged on creation.

---

## Known Limitations

- Email notifications are simulated (in-app only).
- SSE manager is in-process — use Redis pub/sub for multi-instance deployments.
- Production database is Turso (libsql cloud). Set `DATABASE_URL` and `TURSO_AUTH_TOKEN` in your environment.

---

## Re-seeding

```bash
DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=your-token npx tsx prisma/seed.ts
```

For local development, omit the env vars — it will seed the local `dev.db`.


