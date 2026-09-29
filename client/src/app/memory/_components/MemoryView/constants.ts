export const SCOPES = ["repo", "global", "team"] as const;
export const KINDS = ["decision", "convention", "preference", "fact", "learning"] as const;

/** Entries not updated for this many days are "stale" (hidden by default). */
export const STALE_DAYS = 60;

/** Badge colour per memory kind. */
export const KIND_COLOR: Record<string, string> = {
  decision: "var(--accent)",
  convention: "var(--ok)",
  preference: "var(--warn)",
  fact: "var(--text-secondary)",
  learning: "var(--sugg)",
};
