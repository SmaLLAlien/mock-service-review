import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "6px 0 18px", lineHeight: 1.5 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } satisfies CSSProperties,
  ver: { fontSize: 15, fontWeight: 700 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" } satisfies CSSProperties,
  meta: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } satisfies CSSProperties,
  pre: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    fontSize: 12,
    maxHeight: 260,
    overflow: "auto",
    whiteSpace: "pre-wrap",
  } satisfies CSSProperties,
} as const;
