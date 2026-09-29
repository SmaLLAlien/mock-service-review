/** Where spec files live inside the repo. */
export const SPECS_DIR = ".devdigest/specs/";

/** Colour per repo-intel index status. */
export const INTEL_COLOR: Record<string, string> = {
  full: "var(--ok)",
  partial: "var(--warn)",
  degraded: "var(--warn)",
  failed: "var(--crit)",
};
