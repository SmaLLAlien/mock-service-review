import type { CSSProperties } from "react";

/** Co-located styles for ContextView. */
export const s = {
  titleRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  sub: { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 } satisfies CSSProperties,
  intel: { padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  intelHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  intelMeta: { fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  itemTop: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  itemName: { fontSize: 12.5, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
  muted: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  detail: { padding: "24px 32px 44px", maxWidth: 920 } satisfies CSSProperties,
  detailHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } satisfies CSSProperties,
  path: { fontSize: 15, fontWeight: 700 } satisfies CSSProperties,
  doc: { padding: "18px 22px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 14 } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" } satisfies CSSProperties,
  modalBody: { padding: "4px 24px 8px", display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
} as const;
