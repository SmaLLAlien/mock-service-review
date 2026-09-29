"use client";

import React from "react";
import { Avatar, Badge, Markdown, SectionLabel } from "@devdigest/ui";
import type { PrCommit } from "@devdigest/shared";
import type { PrDetail } from "@/lib/types";
import { s } from "./styles";

interface OverviewTabProps {
  prBody: string | null | undefined;
  /** Linked issue (from "Closes #N") — shown when present. */
  linkedIssue?: PrDetail["linked_issue"];
  commits?: PrCommit[];
}

export function OverviewTab({ prBody, linkedIssue, commits }: OverviewTabProps) {
  return (
    <>
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>
            <Markdown>{prBody}</Markdown>
          </div>
        </section>
      )}
      {linkedIssue && (
        <section>
          <SectionLabel icon="Link">Linked issue</SectionLabel>
          <div style={s.card}>
            <div style={s.issueHead}>
              <span className="mono" style={s.muted}>#{linkedIssue.number}</span>
              <span style={s.issueTitle}>{linkedIssue.title}</span>
              <Badge dot bg="transparent" color={linkedIssue.state === "open" ? "var(--ok)" : "var(--stale)"}>
                {linkedIssue.state}
              </Badge>
            </div>
            {linkedIssue.body && <div style={s.issueBody}>{linkedIssue.body}</div>}
          </div>
        </section>
      )}
      {commits && commits.length > 0 && (
        <section>
          <SectionLabel icon="GitCommit">Commits · {commits.length}</SectionLabel>
          <div style={s.card}>
            {commits.map((c) => (
              <div key={c.sha} style={s.commitRow}>
                <span className="mono" style={s.sha}>{c.sha.slice(0, 7)}</span>
                <span style={s.commitMsg}>{c.message}</span>
                <Avatar name={c.author} size={16} />
                <span style={s.muted}>{c.author}</span>
                {c.committed_at && <span style={s.muted}>{new Date(c.committed_at).toLocaleString()}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
