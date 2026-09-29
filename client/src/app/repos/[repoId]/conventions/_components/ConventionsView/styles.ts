import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. */
export const s = {
  page: { padding: "24px 32px 44px", maxWidth: 1100, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 } satisfies CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginTop: 4, maxWidth: 640 } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 } satisfies CSSProperties,
  count: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  rule: { fontSize: 15, fontWeight: 600, lineHeight: 1.45 } satisfies CSSProperties,
  meta: { display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" } satisfies CSSProperties,
  confWrap: { display: "flex", alignItems: "center", gap: 8, width: 200 } satisfies CSSProperties,
  label: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  snippet: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 7,
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    fontSize: 12.5,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 8, marginTop: 12 } satisfies CSSProperties,
} as const;
