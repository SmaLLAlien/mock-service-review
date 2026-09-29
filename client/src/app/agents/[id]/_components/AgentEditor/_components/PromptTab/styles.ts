import type { CSSProperties } from "react";

/** Co-located styles for PromptTab. */
export const s = {
  wrap: { maxWidth: 900 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "6px 0 18px", lineHeight: 1.5 } satisfies CSSProperties,
  prRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, maxWidth: 560 } satisfies CSSProperties,
  prLabel: { fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" } satisfies CSSProperties,
  pipeline: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 20 } satisfies CSSProperties,
  step: (on: boolean, color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: `1px solid ${on ? color : "var(--border)"}`,
    color: on ? "var(--text-primary)" : "var(--text-muted)",
    background: on ? "var(--bg-elevated)" : "transparent",
    textDecoration: on ? "none" : "line-through",
  }),
  dot: (color: string): CSSProperties => ({ width: 7, height: 7, borderRadius: 999, background: color }),
  arrow: { color: "var(--text-muted)" } satisfies CSSProperties,
  blocks: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  chips: { display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0 16px" } satisfies CSSProperties,
} as const;
