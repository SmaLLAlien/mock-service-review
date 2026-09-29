import type { CSSProperties } from "react";

/** Co-located styles for SkillPreview. */
export const s = {
  wrap: { padding: "24px 32px 44px", maxWidth: 900 } satisfies CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" } satisfies CSSProperties,
  desc: { fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 16px" } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  toggleLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  notice: { display: "flex", gap: 10, padding: "12px 14px", borderRadius: 8, background: "var(--warn-bg)", border: "1px solid var(--warn)", fontSize: 13, lineHeight: 1.5, marginBottom: 16 } satisfies CSSProperties,
  section: { marginTop: 22 } satisfies CSSProperties,
  chips: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  body: { padding: "16px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8, marginTop: 10 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  verRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 } satisfies CSSProperties,
} as const;
