/* SkillsTab — link workspace skills to an agent and order them. Linked,
   enabled skills are concatenated (in this order) into the "## Skills / rules"
   section of the agent's review prompt. Saving creates a new agent version. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, IconBtn, Skeleton, TextInput, Toggle, SectionLabel } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills, type SkillRecord } from "@/lib/hooks/knowledge";
import { notify } from "@/lib/toast";
import { s } from "./styles";

const UNTRUSTED = new Set(["imported_url", "community"]);

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const ts = useTranslations("skills");
  const router = useRouter();
  const { data: links, isLoading: linksLoading } = useAgentSkills(agent.id);
  const { data: skills, isLoading: skillsLoading } = useSkills();
  const setSkills = useSetAgentSkills(agent.id);
  const [filter, setFilter] = React.useState("");

  const linkedIds = (links ?? []).map((l) => l.skill_id);
  const byId = new Map((skills ?? []).map((sk) => [sk.id, sk]));
  const linked = linkedIds.map((id) => byId.get(id)).filter((x): x is SkillRecord => !!x);
  const available = (skills ?? [])
    .filter((sk) => !linkedIds.includes(sk.id))
    .filter((sk) => !filter || `${sk.name} ${sk.description}`.toLowerCase().includes(filter.toLowerCase()));

  const save = (ids: string[]) =>
    setSkills.mutate(ids, {
      onSuccess: () => notify.success(t("skills.saved", { version: agent.version + 1 })),
    });
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...linkedIds];
    const [x] = next.splice(idx, 1);
    next.splice(idx + dir, 0, x!);
    save(next);
  };

  if (linksLoading || skillsLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={24} width={200} />
        <Skeleton height={64} style={{ marginTop: 16 }} />
        <Skeleton height={64} style={{ marginTop: 8 }} />
      </div>
    );
  }

  const row = (sk: SkillRecord, idx: number | null) => (
    <div key={sk.id} style={s.row(idx !== null)}>
      {idx !== null && <span style={s.order}>{idx + 1}</span>}
      <div style={s.body}>
        <div style={s.nameRow}>
          <span className="mono" style={s.name}>{sk.name}</span>
          <Badge>{ts(`listItem.type.${sk.type}`)}</Badge>
          <Badge color="var(--text-muted)" bg="transparent">{ts(`listItem.source.${sk.source}`)}</Badge>
          <span style={s.muted}>v{sk.version}</span>
          {!sk.enabled && (
            <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
              {UNTRUSTED.has(sk.source) ? ts("listItem.needsVetting") : t("skills.disabledNote")}
            </Badge>
          )}
        </div>
        <div style={s.desc}>{sk.description}</div>
      </div>
      {idx !== null && (
        <div style={s.arrows}>
          <IconBtn icon="ArrowUp" label={t("skills.moveUp")} size={26} onClick={() => idx > 0 && move(idx, -1)} />
          <IconBtn
            icon="ArrowDown"
            label={t("skills.moveDown")}
            size={26}
            onClick={() => idx < linkedIds.length - 1 && move(idx, 1)}
          />
        </div>
      )}
      <Toggle
        on={idx !== null}
        size={16}
        onChange={(on) => save(on ? [...linkedIds, sk.id] : linkedIds.filter((x) => x !== sk.id))}
      />
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={s.count}>
          {t("skills.enabledCount", { linked: linked.length, total: skills?.length ?? 0 })}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button kind="ghost" size="sm" icon="ExternalLink" onClick={() => router.push("/skills")}>
            {t("skills.manage")}
          </Button>
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      <SectionLabel icon="Sparkles">{t("skills.linked")}</SectionLabel>
      <div style={s.list}>
        {linked.length === 0 ? (
          <EmptyState icon="Sparkles" title={t("skills.none")} />
        ) : (
          linked.map((sk, i) => row(sk, i))
        )}
      </div>

      <SectionLabel icon="Layers">{t("skills.available")}</SectionLabel>
      <div style={s.filter}>
        <TextInput value={filter} onChange={setFilter} placeholder={t("skills.filterPlaceholder")} />
      </div>
      <div style={s.list}>
        {available.length === 0 ? (
          <div style={s.muted}>{t("skills.noMatch")}</div>
        ) : (
          available.map((sk) => row(sk, null))
        )}
      </div>
    </div>
  );
}
