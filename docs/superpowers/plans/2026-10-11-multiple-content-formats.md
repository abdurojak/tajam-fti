# Multiple Content Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow web and Excel users to assign several approved formats to one content plan.

**Architecture:** Keep the existing string field and database payload. Centralize comma-separated parsing and canonicalization in the domain module, consume that behavior from validation and the checkbox UI, and let the generated workbook explain multi-value input rather than using a single-select list validation.

**Tech Stack:** Next.js 16, React 19, TypeScript, ExcelJS, Vitest.

---

### Task 1: Add canonical multi-format validation

**Files:**

- Modify: `src/lib/domain.ts`
- Test: `tests/domain.test.ts`

- [x] Add tests proving `Reels, Story` is accepted, whitespace/case/duplicates normalize to canonical names, and unknown formats are rejected.
- [x] Run `npx vitest run tests/domain.test.ts` and confirm the new tests fail because the existing enum validator only accepts one exact value.
- [x] Add `parseFormats` and use it to canonicalize `data.format` before enum validation.
- [x] Run the targeted test and confirm it passes.

### Task 2: Make generated workbooks accept multiple formats

**Files:**

- Modify: `src/lib/workbook.ts`
- Test: `tests/workbook.test.ts`

- [x] Add tests for a multi-format workbook round trip and for a Format-cell input prompt that does not use single-select list validation.
- [x] Run `npx vitest run tests/workbook.test.ts` and confirm the prompt test fails.
- [x] Skip list validation for Format, add a permissive custom validation with a comma-separated prompt, and update the Panduan text.
- [x] Run the workbook tests and confirm they pass.

### Task 3: Add the web multi-select UI

**Files:**

- Modify: `src/components/content-form.tsx`
- Modify: `src/app/globals.css`

- [x] Replace the Format select with accessible checkboxes that serialize selected options through the domain helper.
- [x] Add scoped styling for the checkbox grid and mobile layout.
- [x] Run `npm run typecheck` and fix any type errors.

### Task 4: Verify and deliver

**Files:**

- Modify: `docs/superpowers/plans/2026-10-11-multiple-content-formats.md`

- [x] Run `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- [x] Mark completed plan steps and review the diff for unrelated files before delivery.
