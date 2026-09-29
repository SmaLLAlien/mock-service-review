/* VersionsTab — immutable config snapshots (agent_versions). Each change to
   provider/model/prompt/strategy/gate/repo-intel/skills bumps the version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentVersions } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/knowledge";
import { s } from "./styles";

export function VersionsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data, isLoading, isError, refetch } = useAgentVersions(agent.id);
  const { data: skills } = useSkills();
  const [open, setOpen] = React.useState<number | null>(null);
  const skillName = (id: string) => skills?.find((x) => x.id === id)?.name ?? id.slice(0, 8);

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("versions.title")}</h2>
      <p style={s.subtitle}>{t("versions.subtitle")}</p>
      {isLoading && <Skeleton height={120} />}
      {isError && <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon="History" title={t("versions.empty")} />}
      <div style={s.list}>
        {(data ?? []).map((v) => (
          <Card key={v.version}>
            <div style={s.head}>
              <span className="mono" style={s.ver}>v{v.version}</span>
              {v.version === agent.version && <Badge color="var(--ok)" bg="var(--ok-bg)" dot>{t("versions.current")}</Badge>}
              <Badge mono>{v.config.provider}/{v.config.model}</Badge>
              <span style={s.date}>{new Date(v.created_at).toLocaleString()}</span>
            </div>
            <div style={s.meta}>
              <Badge>{v.config.strategy}</Badge>
              <Badge>ci: {v.config.ci_fail_on}</Badge>
              <Badge>repo-intel: {v.config.repo_intel ? "on" : "off"}</Badge>
              <Badge icon="Sparkles">{t("versions.skills", { count: v.config.skills.length })}</Badge>
              {v.config.skills.map((id) => (
                <Badge key={id} mono color="var(--text-muted)" bg="transparent">{skillName(id)}</Badge>
              ))}
              <Button kind="ghost" size="sm" icon={open === v.version ? "EyeOff" : "Eye"} onClick={() => setOpen(open === v.version ? null : v.version)}>
                {t("versions.promptLines", { count: v.config.system_prompt.split("\n").length })}
              </Button>
            </div>
            {open === v.version && <pre className="mono" style={s.pre}>{v.config.system_prompt}</pre>}
          </Card>
        ))}
      </div>
    </div>
  );
}
