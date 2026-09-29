/** Filter chips for the candidate list. */
export const FILTERS = ["all", "pending", "accepted"] as const;
export type ConventionFilter = (typeof FILTERS)[number];

/** Confidence at/above which a candidate is shown as "strong". */
export const STRONG_CONFIDENCE = 0.85;
