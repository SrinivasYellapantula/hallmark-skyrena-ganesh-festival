export const CULTURAL_CATEGORIES = [
  "Singing",
  "Dance",
  "Skit / Drama",
  "Musical Instrument",
  "Poem / Sloka / Story",
  "Mono Act",
  "Other",
] as const;

export const CULTURAL_STATUSES = [
  "submitted",
  "under_review",
  "clarification_required",
  "approved",
  "waitlisted",
  "scheduled",
  "completed",
  "withdrawn",
] as const;

export const CULTURAL_STATUS_LABELS: Record<(typeof CULTURAL_STATUSES)[number], string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  clarification_required: "Clarification Required",
  approved: "Approved",
  waitlisted: "Waitlisted",
  scheduled: "Scheduled",
  completed: "Completed",
  withdrawn: "Withdrawn",
};
