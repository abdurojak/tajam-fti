# Multiple Content Formats Design

## Goal

Allow one content plan to use one or more approved formats without changing the existing storage schema or creating duplicate calendar events.

## Data and validation

The existing `format` string remains the stored field. Multiple values use a canonical comma-separated representation such as `Reels, Story`. Validation splits on commas, trims whitespace, matches approved formats case-insensitively, removes duplicates, preserves the user's order, and stores canonical format names. At least one valid format remains required. Any unknown item rejects the row and names the unsupported value.

Existing records containing one format remain valid. Reports, PDF output, tables, and Google Calendar descriptions already render the field as text, so they will show the canonical list without schema changes. One content plan continues to create one Google Calendar event.

## Web form

Replace the single Format select with a group of checkboxes containing all approved formats. Editing an existing record initializes the checked states from its stored string. Checking or clearing an item updates the canonical comma-separated value. The group remains required and displays the existing field validation message.

## Excel template

The Format column accepts comma-separated approved names. Because native Excel list validation cannot select several values without macros, the generated workbook replaces its one-choice dropdown with an input prompt explaining the comma-separated syntax. The Referensi sheet continues to list every approved format. The Panduan sheet includes an example. Import remains compatible with the original supplied template and validates multiple values in the application.

## Verification

Automated tests cover single values, normalization, duplicate removal, invalid values, workbook round-trip, and the generated template prompt. Type checking, the full test suite, and a production build must pass.
