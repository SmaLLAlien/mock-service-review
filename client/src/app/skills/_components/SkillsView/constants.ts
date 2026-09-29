/** Sources whose bodies are untrusted and must be vetted before enabling. */
export const UNTRUSTED_SOURCES: readonly string[] = ["imported_url", "community"];

/** Colour token per skill type (badge tint). */
export const TYPE_COLOR: Record<string, string> = {
  rubric: "var(--accent)",
  convention: "var(--ok)",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};
