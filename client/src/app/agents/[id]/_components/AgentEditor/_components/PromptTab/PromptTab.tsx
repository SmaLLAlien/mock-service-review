/* PromptTab — "how does the agent see a PR?". Shows the prompt exactly as the
   reviewer assembles it (reviewer-core assemblePrompt): system prompt +
   injection guard, then task, PR description, skills, memory, repo skeleton,
   project context, callers and the diff — for any PR of the active repo. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Icon, SectionLabel, SelectInput, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { usePromptPreview } from "@/lib/hooks/agents";
import { usePulls } from "@/lib/hooks";
import { useActiveRepo } from "@/lib/repo-context";
import { PromptBlock } from "@/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/PromptBlock";
import { PROMPT_COLORS } from "@/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/constants";
import { s } from "./styles";

const approxTokens = (text: string | null | undefined) => Math.ceil((text ?? "").length / 4);

export function PromptTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { repoId } = useActiveRepo();
  const { data: pulls } = usePulls(repoId);
  const [prId, setPrId] = React.useState<string | null>(null);
  const { data, isLoading, isError, refetch } = usePromptPreview(agent.id, prId);

  React.useEffect(() => {
    if (!prId && pulls?.length) setPrId(pulls.find((p) => p.number === 482)?.id ?? pulls[0]!.id ?? null);
  }, [pulls, prId]);

  const a = data?.assembly;
  const steps: { key: string; label: string; text: string | null | undefined; color: string }[] = a
    ? [
        { key: "system", label: t("prompt.system"), text: a.system, color: PROMPT_COLORS.system },
        { key: "pr", label: t("prompt.prDescription"), text: a.pr_description, color: PROMPT_COLORS.user },
        { key: "skills", label: t("prompt.skills"), text: a.skills, color: PROMPT_COLORS.skills },
        { key: "memory", label: t("prompt.memory"), text: a.memory, color: PROMPT_COLORS.memory },
        { key: "repoMap", label: t("prompt.repoMap"), text: a.repo_map, color: PROMPT_COLORS.repoMap },
        { key: "specs", label: t("prompt.specs"), text: a.specs, color: PROMPT_COLORS.specs },
        { key: "callers", label: t("prompt.callers"), text: a.callers, color: PROMPT_COLORS.callers },
      ]
    : [];

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("prompt.title")}</h2>
      <p style={s.subtitle}>{t("prompt.subtitle")}</p>

      <div style={s.prRow}>
        <span style={s.prLabel}>{t("prompt.pr")}</span>
        <div style={{ flex: 1 }}>
          <SelectInput
            mono={false}
            value={prId ?? ""}
            onChange={setPrId}
            options={(pulls ?? []).map((p) => ({ value: p.id ?? "", label: `#${p.number} · ${p.title}` }))}
          />
        </div>
      </div>

      {isLoading && <Skeleton height={220} />}
      {isError && <ErrorState body={t("prompt.loadError")} onRetry={() => refetch()} />}
      {a && data && (
        <>
          <SectionLabel icon="Workflow" right={<Badge mono>{t("prompt.tokens", { count: approxTokens(a.system) + approxTokens(a.user) })}</Badge>}>
            {t("prompt.pipeline")}
          </SectionLabel>
          <div style={s.pipeline}>
            {steps.map((st, i) => (
              <React.Fragment key={st.key}>
                {i > 0 && <Icon.ArrowRight size={12} style={s.arrow} />}
                <span style={s.step(!!st.text, st.color)} title={st.text ? t("prompt.tokens", { count: approxTokens(st.text) }) : t("prompt.empty")}>
                  <span style={s.dot(st.color)} />
                  {st.label}
                </span>
              </React.Fragment>
            ))}
            <Icon.ArrowRight size={12} style={s.arrow} />
            <span style={s.step(true, PROMPT_COLORS.user)}>
              <span style={s.dot(PROMPT_COLORS.user)} />
              Diff
            </span>
          </div>

          {(data.skills.length > 0 || data.specs.length > 0) && (
            <div style={s.chips}>
              {data.skills.map((n) => (
                <Badge key={n} icon="Sparkles" mono>{n}</Badge>
              ))}
              {data.specs.map((p) => (
                <Badge key={p} icon="FileText" mono color="var(--text-muted)">{p}</Badge>
              ))}
            </div>
          )}

          <div style={s.blocks}>
            {steps.filter((st) => st.text).map((st) => (
              <PromptBlock key={st.key} label={`${st.label} · ${t("prompt.tokens", { count: approxTokens(st.text) })}`} text={st.text ?? ""} color={st.color} />
            ))}
            <PromptBlock label={`${t("prompt.user")} · ${t("prompt.tokens", { count: approxTokens(a.user) })}`} text={a.user} color={PROMPT_COLORS.user} />
          </div>
        </>
      )}
    </div>
  );
}
