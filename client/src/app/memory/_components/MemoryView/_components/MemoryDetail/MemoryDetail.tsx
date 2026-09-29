/* MemoryDetail — one memory entry: content, confidence/scope/updated stats,
   source contexts (PRs it was learned from), edit + delete. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, MonoLink, SectionLabel, SelectInput, Textarea } from "@devdigest/ui";
import { useDeleteMemory, useUpdateMemory, type MemoryRecord } from "@/lib/hooks/knowledge";
import { useActiveRepo } from "@/lib/repo-context";
import { usePulls } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { KINDS, KIND_COLOR, SCOPES } from "../../constants";
import { s } from "./styles";

export function MemoryDetail({ item, onDeleted }: { item: MemoryRecord; onDeleted: () => void }) {
  const t = useTranslations("memory");
  const router = useRouter();
  const { repoId, activeRepo } = useActiveRepo();
  const { data: pulls } = usePulls(repoId);
  const update = useUpdateMemory();
  const del = useDeleteMemory();
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(item.content);
  const [kind, setKind] = React.useState<string>(item.kind);
  const [scope, setScope] = React.useState<string>(item.scope);

  React.useEffect(() => {
    setEditing(false);
    setContent(item.content);
    setKind(item.kind);
    setScope(item.scope);
  }, [item.id, item.content, item.kind, item.scope]);

  const prLink = (n: number) =>
    item.repo === activeRepo?.full_name && pulls?.some((p) => p.number === n)
      ? () => router.push(`/repos/${repoId}/pulls/${n}`)
      : undefined;

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <Badge color={KIND_COLOR[item.kind]}>{t(`kind.${item.kind}`)}</Badge>
        <Badge color="var(--text-muted)" bg="transparent">{t(`scope.${item.scope}`)}</Badge>
        {item.repo && <Badge mono icon="GitBranch">{item.repo}</Badge>}
        <div style={s.actions}>
          {!editing && <Button kind="ghost" size="sm" icon="Edit" onClick={() => setEditing(true)}>{t("detail.edit")}</Button>}
          <Button
            kind="ghost"
            size="sm"
            icon="Trash"
            onClick={() => window.confirm(t("detail.deleteConfirm")) && del.mutate(item.id, { onSuccess: onDeleted })}
          >
            {t("detail.delete")}
          </Button>
        </div>
      </div>

      {editing ? (
        <>
          <FormField label={t("detail.contentLabel")}>
            <Textarea value={content} onChange={setContent} rows={5} />
          </FormField>
          <div style={s.editRow}>
            <div style={{ flex: 1 }}>
              <FormField label={t("detail.kindLabel")}>
                <SelectInput mono={false} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))} />
              </FormField>
            </div>
            <div style={{ flex: 1 }}>
              <FormField label={t("detail.scopeLabel")}>
                <SelectInput mono={false} value={scope} onChange={setScope} options={SCOPES.map((k) => ({ value: k, label: t(`scope.${k}`) }))} />
              </FormField>
            </div>
          </div>
          <div style={s.editRow}>
            <Button
              kind="primary"
              size="sm"
              icon="Check"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: item.id, patch: { content, kind: kind as MemoryRecord["kind"], scope: scope as MemoryRecord["scope"] } },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              {t("detail.save")}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>{t("detail.cancel")}</Button>
          </div>
        </>
      ) : (
        <div style={s.content}>{item.content}</div>
      )}

      <div style={s.stats}>
        <div style={s.stat}>
          <div style={s.statLabel}>{t("detail.stat.confidence")}</div>
          <div className="mono tnum" style={s.statValue}>{Math.round(item.confidence * 100)}%</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>{t("detail.stat.scope")}</div>
          <div style={s.statValue}>{t(`scope.${item.scope}`)}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>{t("detail.stat.updated")}</div>
          <div style={s.statValue}>{new Date(item.updated_at).toLocaleDateString()}</div>
        </div>
      </div>

      <SectionLabel icon="Link">{t("detail.sourceContexts")}</SectionLabel>
      {item.sources.length === 0 ? (
        <div style={s.muted}>{t("detail.noSources")}</div>
      ) : (
        item.sources.map((src, i) => (
          <div key={i} style={s.source}>
            {src.pr != null ? (
              <MonoLink onClick={prLink(src.pr)}>{t("detail.prLabel", { pr: src.pr })}</MonoLink>
            ) : (
              <Badge color="var(--text-muted)">—</Badge>
            )}
            <span>{src.context}</span>
          </div>
        ))
      )}
      <div style={{ ...s.muted, marginTop: 14 }}>
        {t("detail.created")}: {new Date(item.created_at).toLocaleString()}
      </div>
    </div>
  );
}
