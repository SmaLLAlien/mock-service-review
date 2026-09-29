/* MemoryView — the agents' long-term memory. Filter by scope/kind/freshness,
   search, add entries manually; entries also arrive from "Learn"/"Dismiss with
   reply" on findings. The most relevant entries are injected into prompts
   ("## Relevant memory"). Selection lives in ?id=. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Chip, ConfidenceNum, EmptyState, ErrorState, FormField, Modal, SelectInput, Skeleton, TextInput, Textarea, Toggle } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { SplitPane, ListRow } from "@/components/split-pane";
import { useActiveRepo } from "@/lib/repo-context";
import { useCreateMemory, useMemory } from "@/lib/hooks/knowledge";
import { MemoryDetail } from "./_components/MemoryDetail";
import { KINDS, KIND_COLOR, SCOPES } from "./constants";
import { daysSince, isStale } from "./helpers";
import { s } from "./styles";

export function MemoryView() {
  const t = useTranslations("memory");
  const router = useRouter();
  const search = useSearchParams();
  const { activeRepo } = useActiveRepo();
  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState<string[]>([]);
  const [kind, setKind] = React.useState<string[]>([]);
  const [showStale, setShowStale] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const { data, isLoading, isError, refetch } = useMemory({ q, scope, kind });

  const list = (data ?? []).filter((m) => showStale || !isStale(m.updated_at));
  const selectedId = search.get("id") ?? list[0]?.id ?? null;
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const usedLabel = (iso: string | null) => {
    const d = daysSince(iso);
    if (d == null) return t("card.neverUsed");
    if (d === 0) return t("card.usedToday");
    if (d === 1) return t("card.usedDayAgo");
    return t("card.usedDaysAgo", { days: d });
  };

  const head = (
    <>
      <div style={s.titleRow}>
        <h1 style={s.h1}>{t("page.heading")}</h1>
        <Button kind="primary" size="sm" icon="Plus" onClick={() => setAdding(true)}>{t("page.add")}</Button>
      </div>
      <span style={s.count}>{t("page.count", { count: list.length })}</span>
      <TextInput value={q} onChange={setQ} placeholder={t("page.searchPlaceholder")} />
      <span style={s.filterLabel}>{t("page.filters.scope")}</span>
      <div style={s.chips}>
        {SCOPES.map((v) => (
          <Chip key={v} active={scope.includes(v)} onClick={() => setScope(toggle(scope, v))}>{t(`scope.${v}`)}</Chip>
        ))}
      </div>
      <span style={s.filterLabel}>{t("page.filters.kind")}</span>
      <div style={s.chips}>
        {KINDS.map((v) => (
          <Chip key={v} active={kind.includes(v)} onClick={() => setKind(toggle(kind, v))} color={KIND_COLOR[v]}>{t(`kind.${v}`)}</Chip>
        ))}
      </div>
      <label style={s.staleRow}>
        <Toggle on={showStale} onChange={setShowStale} size={14} />
        {t("page.filters.showStale")}
      </label>
    </>
  );

  const listNode = isLoading ? (
    <Skeleton height={70} />
  ) : isError ? (
    <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />
  ) : list.length === 0 ? (
    <EmptyState icon="Brain" title={t("page.empty.title")} body={t("page.empty.body")} />
  ) : (
    list.map((m) => (
      <ListRow key={m.id} active={m.id === selectedId} onClick={() => router.replace(`/memory?id=${m.id}`)}>
        <div style={s.itemText}>{m.content}</div>
        <div style={s.itemMeta}>
          <Badge color={KIND_COLOR[m.kind]}>{t(`kind.${m.kind}`)}</Badge>
          <Badge color="var(--text-muted)" bg="transparent">{t(`scope.${m.scope}`)}</Badge>
          <ConfidenceNum value={m.confidence} />
          {isStale(m.updated_at) && <Badge color="var(--stale)">{t("page.stale")}</Badge>}
          <span style={{ ...s.muted, marginLeft: "auto" }}>{usedLabel(m.last_used_at)}</span>
        </div>
      </ListRow>
    ))
  );

  return (
    <AppShell crumb={[{ label: t("page.crumb") }]}>
      {adding && <AddMemoryModal repo={activeRepo?.full_name ?? null} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); router.replace(`/memory?id=${id}`); }} />}
      <SplitPane head={head} list={listNode} width={380}>
        {selectedId && data?.some((m) => m.id === selectedId) ? (
          <MemoryDetail item={data.find((m) => m.id === selectedId)!} onDeleted={() => router.replace("/memory")} />
        ) : (
          !isLoading && <div style={{ padding: 48 }}><EmptyState icon="Brain" title={t("detail.selectTitle")} body={t("detail.selectBody")} /></div>
        )}
      </SplitPane>
    </AppShell>
  );
}

function AddMemoryModal({ repo, onClose, onCreated }: { repo: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations("memory");
  const create = useCreateMemory();
  const [content, setContent] = React.useState("");
  const [scope, setScope] = React.useState<string>("repo");
  const [kind, setKind] = React.useState<string>("fact");
  return (
    <Modal
      width={560}
      title={t("add.title")}
      onClose={onClose}
      footer={
        <Button
          kind="primary"
          icon="Check"
          disabled={!content.trim()}
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              { content, scope: scope as "repo", kind: kind as "fact", repo: scope === "repo" ? repo : null },
              { onSuccess: (m) => onCreated(m.id) },
            )
          }
        >
          {t("add.save")}
        </Button>
      }
    >
      <div style={s.modalBody}>
        <FormField label={t("detail.contentLabel")} required>
          <Textarea value={content} onChange={setContent} rows={4} placeholder={t("add.contentPlaceholder")} />
        </FormField>
        <div style={s.modalRow}>
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
      </div>
    </Modal>
  );
}
