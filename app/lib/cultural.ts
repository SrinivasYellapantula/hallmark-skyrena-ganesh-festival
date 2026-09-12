export const CULTURAL_CATEGORIES = [
  "Fancy Dress",
  "Singing",
  "Dance",
  "Kolatam",
  "Skit / Drama",
  "Musical Instrument",
  "Poem / Sloka / Story",
  "Mono Act",
  "Other",
] as const;

export const FANCY_DRESS_DATE = "2026-09-17";
export const FANCY_DRESS_TIME = "19:00";
export const FANCY_DRESS_DEADLINE = "2026-09-13T23:59:59+05:30";

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
