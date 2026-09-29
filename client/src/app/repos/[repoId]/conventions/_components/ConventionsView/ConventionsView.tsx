/* ConventionsView — conventions extracted from the active repo. Each candidate
   is grounded by an evidence file + snippet; "Accept as Skill" turns it into a
   `convention` skill that agents can link (and inject into their prompts). */
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Icon, ProgressBar, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { useAcceptConvention, useConventions, useDeleteConvention, useExtractConventions } from "@/lib/hooks/knowledge";
import { notify } from "@/lib/toast";
import { FILTERS, STRONG_CONFIDENCE, type ConventionFilter } from "./constants";
import { s } from "./styles";

export function ConventionsView() {
  const t = useTranslations("conventions");
  const router = useRouter();
  const { repoId } = useParams<{ repoId: string }>();
  const { activeRepo } = useActiveRepo();
  const notFound = useRepoNotFound(repoId);
  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const accept = useAcceptConvention(repoId);
  const discard = useDeleteConvention(repoId);
  const [filter, setFilter] = React.useState<ConventionFilter>("all");

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");
  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];
  if (notFound) return <AppShell crumb={crumb}><RepoNotFound /></AppShell>;

  const all = data ?? [];
  const list = all.filter((c) => filter === "all" || (filter === "accepted" ? c.accepted : !c.accepted));
  const runExtraction = () =>
    extract.mutate(undefined, { onError: (e) => notify.error(e instanceof Error ? e.message : t("page.extractionFailed")) });

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={{ flex: 1 }}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono">{repoName}</span>
            </h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          {all.length > 0 && (
            <Button kind="secondary" size="sm" icon="RefreshCw" loading={extract.isPending} onClick={runExtraction}>
              {extract.isPending ? t("page.scanning") : t("page.rescan")}
            </Button>
          )}
        </div>

        {isLoading && <Skeleton height={120} />}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && all.length === 0 && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={extract.isPending ? t("page.scanning") : t("page.empty.cta")}
            ctaLoading={extract.isPending}
            onCta={runExtraction}
          />
        )}

        {all.length > 0 && (
          <>
            <div style={s.toolbar}>
              {FILTERS.map((f) => (
                <Chip
                  key={f}
                  active={filter === f}
                  onClick={() => setFilter(f)}
                  count={f === "all" ? all.length : all.filter((c) => (f === "accepted" ? c.accepted : !c.accepted)).length}
                >
                  {t(`page.filters.${f}`)}
                </Chip>
              ))}
              <span style={s.count}>{t("page.candidateCount", { count: all.length })}</span>
            </div>
            <div style={s.list}>
              {list.map((c) => (
                <Card key={c.id}>
                  <div style={s.rule}>{c.rule}</div>
                  <div style={s.meta}>
                    <div style={s.confWrap}>
                      <span style={s.label}>{t("card.confidence")}</span>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={c.confidence * 100} color={c.confidence >= STRONG_CONFIDENCE ? "var(--ok)" : "var(--warn)"} />
                      </div>
                      <span className="mono tnum" style={s.label}>{Math.round(c.confidence * 100)}%</span>
                    </div>
                    <Badge mono icon="FileText">{c.evidence_path}</Badge>
                    {c.accepted && <Badge color="var(--ok)" bg="var(--ok-bg)" icon="CheckCircle">{t("card.accepted")}</Badge>}
                  </div>
                  <pre className="mono" style={s.snippet}>{c.evidence_snippet}</pre>
                  <div style={s.actions}>
                    {c.accepted ? (
                      <Button kind="ghost" size="sm" icon="Sparkles" onClick={() => router.push("/skills")}>
                        {t("card.viewSkill")}
                      </Button>
                    ) : (
                      <>
                        <Button
                          kind="primary"
                          size="sm"
                          icon="Check"
                          loading={accept.isPending && accept.variables === c.id}
                          onClick={() =>
                            accept.mutate(c.id, { onSuccess: (r) => notify.success(t("card.acceptedToast", { name: r.skill.name })) })
                          }
                        >
                          {accept.isPending && accept.variables === c.id ? t("card.accepting") : t("card.acceptAsSkill")}
                        </Button>
                        <Button kind="ghost" size="sm" icon="X" onClick={() => discard.mutate(c.id)}>
                          {t("card.delete")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        {extract.isPending && all.length > 0 && (
          <div style={{ ...s.label, marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon.RefreshCw size={12} /> {t("page.scanning")}
          </div>
        )}
      </div>
    </AppShell>
  );
}
