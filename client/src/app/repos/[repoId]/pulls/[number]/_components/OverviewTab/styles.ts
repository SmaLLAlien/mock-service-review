import type { CSSProperties } from "react";

export const s = {
  descriptionBox: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 18,
    fontSize: 14,
    color: "var(--text-secondary)",
    lineHeight: 1.55,
  } satisfies CSSProperties,
  card: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
    padding: "4px 16px",
  } satisfies CSSProperties,
  issueHead: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px" } satisfies CSSProperties,
  issueTitle: { fontSize: 14, fontWeight: 600, flex: 1 } satisfies CSSProperties,
  issueBody: { fontSize: 13, color: "var(--text-secondary)", paddingBottom: 12 } satisfies CSSProperties,
  commitRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  } satisfies CSSProperties,
  sha: { fontSize: 12, color: "var(--accent-text)" } satisfies CSSProperties,
  commitMsg: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
  muted: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
