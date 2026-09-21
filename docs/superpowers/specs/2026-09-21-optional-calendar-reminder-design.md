# Optional Google Calendar reminder

TAJAM content may optionally carry an event start time and one popup reminder: at start, 10, 30, or 60 minutes before start. Both values are empty for existing content. A reminder requires a start time. The form exposes both fields in the scheduling section.

When a start time is present, the Google event spans one hour in Asia/Jakarta. Otherwise it remains an all-day event. Selected reminders override the calendar default; no selection preserves default calendar behavior. Existing JSON payloads and Excel templates stay valid. Excel import/export does not add columns in this change, so imported rows have no explicit reminder.

Validation rejects malformed times and unsupported reminder values. Tests cover normalization and Google event payloads, including the unchanged all-day case.
