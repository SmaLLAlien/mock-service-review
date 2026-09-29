/* SkillsView — Skills library (Skills Lab). Left: searchable list with type,
   source, vetting and usage. Right: SkillPreview (enable, edit → new version,
   linked agents, versions). "Add Skill" opens AddSkillDrawer (file / URL /
   community). Selection lives in ?id=. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Dropdown, EmptyState, ErrorState, Skeleton, TextInput } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { SplitPane, ListRow } from "@/components/split-pane";
import { useSkills } from "@/lib/hooks/knowledge";
import { SkillPreview } from "./_components/SkillPreview";
import { AddSkillDrawer, type AddTab } from "./_components/AddSkillDrawer";
import { TYPE_COLOR, UNTRUSTED_SOURCES } from "./constants";
import { s } from "./styles";

export function SkillsView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const search = useSearchParams();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState<AddTab | null>(null);

  const list = (skills ?? []).filter((sk) => !q || `${sk.name} ${sk.description}`.toLowerCase().includes(q.toLowerCase()));
  const selectedId = search.get("id") ?? list[0]?.id ?? null;
  const select = (id: string) => router.replace(`/skills?id=${id}`);

  const head = (
    <>
      <div style={s.titleRow}>
        <h1 style={s.h1}>{t("page.heading")}</h1>
        <Dropdown
          width={230}
          align="right"
          trigger={<Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">{t("page.addSkill")}</Button>}
          items={[
            { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setAdding("file") },
            { label: t("page.menu.fromUrl"), icon: "Link", onClick: () => setAdding("url") },
            { label: t("page.menu.community"), icon: "Globe", onClick: () => setAdding("community") },
          ]}
        />
      </div>
      <TextInput value={q} onChange={setQ} placeholder={t("page.searchPlaceholder")} />
      <span style={s.count}>{t("page.count", { count: list.length })} · {t("page.subtitle")}</span>
    </>
  );

  const listNode = isLoading ? (
    <>
      <Skeleton height={70} />
      <Skeleton height={70} style={{ marginTop: 6 }} />
    </>
  ) : isError ? (
    <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />
  ) : list.length === 0 ? (
    <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} cta={t("page.empty.cta")} onCta={() => setAdding("file")} />
  ) : (
    list.map((sk) => {
      const untrusted = UNTRUSTED_SOURCES.includes(sk.source);
      return (
        <ListRow key={sk.id} active={sk.id === selectedId} onClick={() => select(sk.id)}>
          <div style={s.itemTop}>
            <span style={s.dot(sk.enabled ? "var(--ok)" : "var(--stale)")} />
            <span className="mono" style={s.itemName}>{sk.name}</span>
            <span style={s.muted}>v{sk.version}</span>
          </div>
          <div style={s.itemDesc}>{sk.description}</div>
          <div style={s.itemMeta}>
            <Badge color={TYPE_COLOR[sk.type]}>{t(`listItem.type.${sk.type}`)}</Badge>
            <span style={s.muted}>{t(`listItem.source.${sk.source}`)}</span>
            {untrusted && !sk.enabled && (
              <span title={t("listItem.vettingTitle")}>
                <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">{t("listItem.needsVetting")}</Badge>
              </span>
            )}
            {(sk.agents?.length ?? 0) > 0 && <Badge icon="Cpu" color="var(--text-muted)" bg="transparent">{sk.agents!.length}</Badge>}
          </div>
        </ListRow>
      );
    })
  );

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {adding && <AddSkillDrawer initialTab={adding} onClose={() => setAdding(null)} onCreated={(id) => { setAdding(null); select(id); }} />}
      <SplitPane head={head} list={listNode} width={360}>
        {selectedId ? (
          <SkillPreview id={selectedId} onDeleted={() => router.replace("/skills")} />
        ) : (
          !isLoading && <div style={{ padding: 48 }}><EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} /></div>
        )}
      </SplitPane>
    </AppShell>
  );
}
