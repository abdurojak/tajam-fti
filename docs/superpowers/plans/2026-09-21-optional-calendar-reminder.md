# Optional Calendar Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement each behavior with a failing test first.

**Goal:** Let a user optionally set a time and Google Calendar reminder for an activity.

**Architecture:** Store optional strings in the existing content JSON payload. Validate in the domain layer and map to Google Calendar event dateTime/reminders only at sync. Keep Excel columns unchanged for compatibility.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest, Google Calendar API.

---

### Task 1: Validate optional scheduling fields

**Files:** `src/lib/domain.ts`, `tests/domain.test.ts`

- [x] Add failing tests for valid HH:mm and selected reminder minutes, invalid values, and reminder without time.
- [x] Run `npx vitest run tests/domain.test.ts` and confirm failures.
- [x] Add optional fields, defaults and validation. Run tests to green.

### Task 2: Map Google Calendar event

**Files:** `src/lib/calendar-sync.ts`, `tests/calendar-sync.test.ts`

- [x] Add failing tests for Jakarta dateTime, one-hour end, popup reminder and unchanged all-day events.
- [x] Run targeted test to confirm failure.
- [x] Add conditional event payload mapping. Run tests to green.

### Task 3: Expose fields and verify

**Files:** `src/components/content-form.tsx`

- [x] Add optional time input and reminder select, disabled until time is present.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Review diff and verify UI through the form component and production build.
