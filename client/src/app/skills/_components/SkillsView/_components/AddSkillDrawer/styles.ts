import type { CSSProperties } from "react";

/** Co-located styles for AddSkillDrawer. */
export const s = {
  body: { padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
  row: { display: "flex", gap: 10, alignItems: "center" } satisfies CSSProperties,
  card: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)" } satisfies CSSProperties,
  cardName: { fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  cardDesc: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 } satisfies CSSProperties,
  cardMeta: { display: "flex", gap: 8, marginTop: 8, fontSize: 12, color: "var(--text-muted)", alignItems: "center" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
} as const;
