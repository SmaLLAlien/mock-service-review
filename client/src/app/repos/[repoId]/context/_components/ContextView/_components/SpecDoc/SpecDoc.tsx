/* SpecDoc — renders a spec's Markdown, drawing ```mermaid fences as diagrams. */
"use client";

import React from "react";
import { Markdown } from "@devdigest/ui";
import { MermaidDiagram } from "@/components/mermaid-diagram";

const FENCE = /```mermaid\n([\s\S]*?)```/g;

export function SpecDoc({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of content.matchAll(FENCE)) {
    const before = content.slice(last, m.index);
    if (before.trim()) parts.push(<Markdown key={`md${i}`}>{before}</Markdown>);
    parts.push(
      <div key={`mm${i}`} style={{ margin: "12px 0", padding: 12, borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <MermaidDiagram chart={m[1] ?? ""} />
      </div>,
    );
    last = (m.index ?? 0) + m[0].length;
    i++;
  }
  const rest = content.slice(last);
  if (rest.trim()) parts.push(<Markdown key="md-last">{rest}</Markdown>);
  return <>{parts}</>;
}
