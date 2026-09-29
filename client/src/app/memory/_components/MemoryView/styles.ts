import type { CSSProperties } from "react";

/** Co-located styles for MemoryView. */
export const s = {
  titleRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  count: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  filterLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" } satisfies CSSProperties,
  chips: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  staleRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  itemText: { fontSize: 13, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } satisfies CSSProperties,
  itemMeta: { display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" } satisfies CSSProperties,
  muted: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  modalBody: { padding: "4px 24px 8px", display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
  modalRow: { display: "flex", gap: 12 } satisfies CSSProperties,
} as const;
