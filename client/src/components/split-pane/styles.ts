import type { CSSProperties } from "react";

/** Co-located styles for SplitPane (list on the left, detail on the right). */
export const s = {
  root: { display: "flex", height: "calc(100vh - 52px)", minHeight: 0 } satisfies CSSProperties,
  left: (width: number): CSSProperties => ({
    width,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    background: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  }),
  leftHead: { padding: "18px 16px 12px", display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  leftList: { flex: 1, overflow: "auto", padding: "0 10px 12px" } satisfies CSSProperties,
  right: { flex: 1, minWidth: 0, overflow: "auto" } satisfies CSSProperties,
  row: (active: boolean): CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 8,
    marginBottom: 4,
    cursor: "pointer",
    border: `1px solid ${active ? "var(--border-strong)" : "transparent"}`,
    background: active ? "var(--bg-elevated)" : "transparent",
  }),
} as const;
