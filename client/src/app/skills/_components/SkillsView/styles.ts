import type { CSSProperties } from "react";

/** Co-located styles for SkillsView. */
export const s = {
  titleRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  count: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  itemTop: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  itemName: { fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
  itemDesc: { fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } satisfies CSSProperties,
  itemMeta: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" } satisfies CSSProperties,
  muted: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  dot: (c: string): CSSProperties => ({ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }),
} as const;
