import type { CSSProperties } from "react";

/** Co-located styles for MemoryDetail. */
export const s = {
  wrap: { padding: "28px 32px 44px", maxWidth: 820 } satisfies CSSProperties,
  head: { display: "flex", gap: 8, alignItems: "center", marginBottom: 14 } satisfies CSSProperties,
  content: { fontSize: 17, lineHeight: 1.55, fontWeight: 500 } satisfies CSSProperties,
  stats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "22px 0" } satisfies CSSProperties,
  stat: { padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" } satisfies CSSProperties,
  statLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" } satisfies CSSProperties,
  statValue: { fontSize: 16, fontWeight: 600, marginTop: 6 } satisfies CSSProperties,
  source: { display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", gap: 8 } satisfies CSSProperties,
  editRow: { display: "flex", gap: 12, marginTop: 12 } satisfies CSSProperties,
} as const;
