/* SplitPane — two-column layout used by the knowledge screens (Skills, Memory,
   Project Context): a fixed-width list column with a header slot on the left
   and a scrollable detail pane on the right. */
"use client";

import React from "react";
import { s } from "./styles";

export function SplitPane({
  head,
  list,
  children,
  width = 340,
}: {
  head?: React.ReactNode;
  list: React.ReactNode;
  children?: React.ReactNode;
  width?: number;
}) {
  return (
    <div style={s.root}>
      <div style={s.left(width)}>
        {head && <div style={s.leftHead}>{head}</div>}
        <div style={s.leftList}>{list}</div>
      </div>
      <div style={s.right}>{children}</div>
    </div>
  );
}

/** A selectable row inside the SplitPane list. */
export function ListRow({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div role="button" tabIndex={0} style={s.row(!!active)} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick?.()}>
      {children}
    </div>
  );
}
