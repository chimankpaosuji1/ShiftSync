# Design Decisions

A living record of the non-obvious choices made while building ShiftSync — and why.

---

## Timezone handling

Each location has one timezone. All times are stored in UTC and displayed in the location's timezone, not the user's browser timezone. Availability windows (e.g. "Mon 9am–5pm") are matched against the shift's location timezone, so "9am" always means "9am at the place you're working," not "9am wherever you happen to live."

For locations near a timezone boundary — a restaurant on the state line, say — pick the timezone of the front door. The single-timezone-per-location model works fine for any fixed physical venue.

---

## De-certification doesn't touch history

Removing a staff member's location certification is a hard delete of the current record. Past shift assignments are untouched and stay in the audit log. The trade-off: fairness reports are built from *current* certifications, so a de-certified employee drops out of location reports even for periods when they were actively working there. Known gap, acceptable for now. If this matters, add `certifiedAt` / `revokedAt` timestamps to the certification table and filter by date range.

---

## Desired hours is advisory, not a constraint

`desiredHours` shows up in the fairness report as a target to measure variance against. It does not affect scheduling constraints, availability checks, or who the system suggests as alternatives. If someone wants 20h but is available 50h, the system won't stop you from assigning them more. That's a manager call, not a system call.

---

## A 1-hour shift counts as a worked day

For consecutive-day tracking, any shift on a calendar day counts as "worked." Duration doesn't matter. This matches how most labor regulations define a day of work. The day boundary uses UTC midnight, which can be off by one for late-evening shifts at non-UTC locations — a known rough edge.

---

## Post-approval shift edits

Approving a swap rewrites the assignment immediately. If the shift is edited afterward (time, skill, headcount), the newly assigned staff member gets a notification, but the approval itself isn't reversed — there's nothing to reverse, the swap is done. The 48-hour edit cutoff handles most of these cases: published shifts close to their start time can't be edited without a manager force-override anyway.

---

## Constraint violations warn, not always block

Overtime warnings (35h+, 40h+) and consecutive-day warnings (6th day) surface in the assign dialog but don't block the assignment. Only hard violations — double booking, missing skill, missing certification, rest period under 10h, 7th consecutive day, daily hours over 12h — actually prevent assignment. Managers see the exact rule broken and suggested alternatives, then decide. The system informs; the manager is accountable.
