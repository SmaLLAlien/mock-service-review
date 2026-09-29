/* ContextView — Project Context for the active repo: spec files (PRDs, tech
   specs, acceptance criteria) that agents read as grounding ("## Project
   context" in the prompt), their index status, and the repo-intel index
   (repo skeleton + callers) with Resync. Specs can be previewed (Markdown +
   mermaid) or edited. Selection lives in ?file=. */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, FormField, Icon, Modal, Skeleton, Tabs, TextInput, Textarea } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { SplitPane, ListRow } from "@/components/split-pane";
import { useContextFiles, useReindexContext } from "@/lib/hooks";
import { useRepoIntelStatus, useResyncRepoIntel } from "@/lib/hooks/repo-intel";
import { useContextStatus, useSaveSpec } from "@/lib/hooks/knowledge";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { notify } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { SpecDoc } from "./_components/SpecDoc";
import { INTEL_COLOR, SPECS_DIR } from "./constants";
import { s } from "./styles";

export function ContextView() {
  const t = useTranslations("context");
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const { repoId } = useParams<{ repoId: string }>();
  const { activeRepo } = useActiveRepo();
  const notFound = useRepoNotFound(repoId);
  const { data: specs, isLoading, isError, refetch } = useContextFiles(repoId);
  const { data: status } = useContextStatus(repoId);
  const reindex = useReindexContext();
  const [polling, setPolling] = React.useState(false);
  const { data: intel } = useRepoIntelStatus(repoId, polling);
  const resync = useResyncRepoIntel(repoId);
  const save = useSaveSpec(repoId);
  const [mode, setMode] = React.useState<"preview" | "edit">("preview");
  const [draft, setDraft] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (polling && intel?.status === "full") setPolling(false);
  }, [polling, intel?.status]);

  const crumb = [{ label: activeRepo?.full_name ?? "repo", mono: true }, { label: t("title") }];
  if (notFound) return <AppShell crumb={crumb}><RepoNotFound /></AppShell>;

  const selectedPath = search.get("file") ?? specs?.[0]?.path ?? null;
  const selected = specs?.find((f) => f.path === selectedPath) ?? null;
  const select = (path: string) => {
    setMode("preview");
    router.replace(`/repos/${repoId}/context?file=${encodeURIComponent(path)}`);
  };

  const head = (
    <>
      <div style={s.titleRow}>
        <h1 style={s.h1}>{t("title")}</h1>
        <Button kind="primary" size="sm" icon="Plus" onClick={() => setCreating(true)}>{t("newSpec")}</Button>
      </div>
      <span style={s.sub}>{t("subtitle")}</span>
      <div style={s.btnRow}>
        <Badge mono icon="Database">{t("chunks", { count: status?.chunks_indexed ?? 0 })}</Badge>
        <Badge color="var(--text-muted)" bg="transparent">{t("indexStatus", { status: status?.status ?? "…" })}</Badge>
        <Button
          kind="secondary"
          size="sm"
          icon="RefreshCw"
          loading={reindex.isPending}
          onClick={() => reindex.mutate(repoId, { onSuccess: () => qc.invalidateQueries({ queryKey: ["context-status", repoId] }) })}
        >
          {reindex.isPending ? t("indexing") : t("reindex")}
        </Button>
      </div>
      <div style={s.intel}>
        <div style={s.intelHead}>
          <Icon.Boxes size={14} />
          {t("repoIntel")}
          {intel && <Badge dot color={INTEL_COLOR[intel.status]} bg="transparent">{polling ? t("resyncing") : intel.status}</Badge>}
          <div style={{ marginLeft: "auto" }}>
            <Button
              kind="ghost"
              size="sm"
              icon="RefreshCw"
              loading={resync.isPending || polling}
              onClick={() => resync.mutate(undefined, { onSuccess: () => setPolling(true) })}
            >
              {t("resync")}
            </Button>
          </div>
        </div>
        {intel && (
          <div style={s.intelMeta}>
            {t("filesIndexed", { indexed: intel.filesIndexed, skipped: intel.filesSkipped })}
            {intel.lastIndexedSha && <> · <span className="mono">{intel.lastIndexedSha.slice(0, 7)}</span></>}
            {(intel.degradedReason || intel.reason) && <div style={{ marginTop: 4, color: "var(--warn)" }}>{intel.degradedReason ?? intel.reason}</div>}
          </div>
        )}
      </div>
    </>
  );

  const listNode = isLoading ? (
    <Skeleton height={48} />
  ) : isError ? (
    <ErrorState body={t("loadError")} onRetry={() => refetch()} />
  ) : (specs ?? []).length === 0 ? (
    <EmptyState icon="FileText" title={t("empty.title")} body={t("empty.body")} cta={t("newSpec")} onCta={() => setCreating(true)} />
  ) : (
    specs!.map((f) => (
      <ListRow key={f.path} active={f.path === selectedPath} onClick={() => select(f.path)}>
        <div style={s.itemTop}>
          <Icon.FileText size={13} style={{ color: "var(--text-muted)" }} />
          <span className="mono" style={s.itemName}>{f.path.replace(SPECS_DIR, "")}</span>
          <span style={s.muted}>{t("kb", { kb: ((f.size ?? 0) / 1024).toFixed(1) })}</span>
        </div>
        {f.updated_at && <div style={{ ...s.muted, marginTop: 4, marginLeft: 21 }}>{t("updated", { date: new Date(f.updated_at).toLocaleDateString() })}</div>}
      </ListRow>
    ))
  );

  return (
    <AppShell crumb={crumb}>
      {creating && (
        <NewSpecModal
          onClose={() => setCreating(false)}
          onCreate={(path, content) =>
            save.mutate({ path, content }, { onSuccess: () => { setCreating(false); select(path); setDraft(content); setMode("edit"); } })
          }
          saving={save.isPending}
        />
      )}
      <SplitPane head={head} list={listNode} width={380}>
        {selected ? (
          <div style={s.detail}>
            <div style={s.detailHead}>
              <Icon.FileText size={16} style={{ color: "var(--accent)" }} />
              <span className="mono" style={s.path}>{selected.path}</span>
              <div style={s.actions}>
                <Tabs
                  value={mode}
                  onChange={(k) => {
                    if (k === "edit") setDraft(selected.content ?? "");
                    setMode(k as "preview" | "edit");
                  }}
                  pad="0"
                  tabs={[
                    { key: "preview", label: t("mode.preview"), icon: "Eye" },
                    { key: "edit", label: t("mode.edit"), icon: "Edit" },
                  ]}
                />
              </div>
            </div>
            {mode === "preview" ? (
              <div style={s.doc}>
                <SpecDoc content={selected.content ?? ""} />
              </div>
            ) : (
              <>
                <Textarea value={draft} onChange={setDraft} rows={24} mono />
                <div style={{ marginTop: 10 }}>
                  <Button
                    kind="primary"
                    size="sm"
                    icon="Check"
                    loading={save.isPending}
                    onClick={() =>
                      save.mutate({ path: selected.path, content: draft }, { onSuccess: () => { notify.success(t("saved")); setMode("preview"); } })
                    }
                  >
                    {save.isPending ? t("editor.saving") : t("editor.save")}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          !isLoading && (specs ?? []).length > 0 && <div style={{ padding: 48 }}><EmptyState icon="FileText" title={t("selectTitle")} body={t("selectBody")} /></div>
        )}
      </SplitPane>
    </AppShell>
  );
}

function NewSpecModal({ onClose, onCreate, saving }: { onClose: () => void; onCreate: (path: string, content: string) => void; saving: boolean }) {
  const t = useTranslations("context");
  const [name, setName] = React.useState("new-spec.md");
  const [content, setContent] = React.useState(t("newSpecTemplate"));
  const path = `${SPECS_DIR}${name.replace(/^\/+/, "")}`;
  return (
    <Modal
      width={620}
      title={t("newSpec")}
      onClose={onClose}
      footer={<Button kind="primary" icon="Check" loading={saving} disabled={!name.trim()} onClick={() => onCreate(path, content)}>{t("create")}</Button>}
    >
      <div style={s.modalBody}>
        <FormField label={t("newSpecPath")} hint={path}>
          <TextInput value={name} onChange={setName} mono />
        </FormField>
        <Textarea value={content} onChange={setContent} rows={12} mono />
      </div>
    </Modal>
  );
}
