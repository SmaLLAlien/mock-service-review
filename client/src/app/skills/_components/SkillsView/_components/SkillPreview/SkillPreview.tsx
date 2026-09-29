/* SkillPreview — one skill: enable/disable (vetting), body preview (Markdown)
   with edit → new immutable version, the agents that inject it, evidence files
   (extracted conventions) and version history. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Icon, Markdown, SectionLabel, Skeleton, Textarea, Toggle, MonoLink } from "@devdigest/ui";
import { useDeleteSkill, useSkill, useSkillVersions, useUpdateSkill } from "@/lib/hooks/knowledge";
import { notify } from "@/lib/toast";
import { TYPE_COLOR, UNTRUSTED_SOURCES } from "../../constants";
import { s } from "./styles";

export function SkillPreview({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skill, isLoading, isError, refetch } = useSkill(id);
  const { data: versions } = useSkillVersions(id);
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [shownVersion, setShownVersion] = React.useState<number | null>(null);

  React.useEffect(() => {
    setEditing(false);
    setShownVersion(null);
  }, [id]);

  if (isLoading) return <div style={s.wrap}><Skeleton height={28} width={300} /><Skeleton height={240} style={{ marginTop: 16 }} /></div>;
  if (isError || !skill) {
    return <div style={s.wrap}><ErrorState title={t("detail.notFound.title")} body={t("detail.notFound.body")} onRetry={() => refetch()} /></div>;
  }

  const untrusted = UNTRUSTED_SOURCES.includes(skill.source);
  const shown = shownVersion != null ? versions?.find((v) => v.version === shownVersion)?.body ?? skill.body : skill.body;

  const save = () =>
    update.mutate(
      { id, patch: { body: draft } },
      {
        onSuccess: (sk) => {
          setEditing(false);
          notify.success(t("preview.saved", { version: sk.version }));
        },
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 className="mono" style={s.h1}>{skill.name}</h1>
        <Badge color={TYPE_COLOR[skill.type]}>{t(`listItem.type.${skill.type}`)}</Badge>
        <Badge color="var(--text-muted)" bg="transparent">{t(`listItem.source.${skill.source}`)}</Badge>
        <Badge mono>{t("preview.version", { version: skill.version })}</Badge>
        {untrusted && <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">{t("preview.untrustedBadge")}</Badge>}
        <div style={s.actions}>
          <label style={s.toggleLabel}>
            {skill.enabled ? t("preview.enabled") : t("preview.disabled")}
            <Toggle on={skill.enabled} size={16} onChange={(enabled) => update.mutate({ id, patch: { enabled } })} />
          </label>
          <Button
            kind="ghost"
            size="sm"
            icon="Trash"
            onClick={() => {
              if (window.confirm(t("preview.deleteConfirm", { name: skill.name }))) del.mutate(id, { onSuccess: onDeleted });
            }}
          >
            {t("preview.delete")}
          </Button>
        </div>
      </div>
      <p style={s.desc}>{skill.description}</p>

      {untrusted && !skill.enabled && (
        <div style={s.notice}>
          <Icon.Shield size={16} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
          <span>{t("preview.untrustedNotice")}</span>
        </div>
      )}

      <div style={s.section}>
        <SectionLabel icon="Cpu">{t("preview.linkedAgents")}</SectionLabel>
        <div style={s.chips}>
          {(skill.agents ?? []).length === 0 ? (
            <span style={s.muted}>{t("preview.noAgents")}</span>
          ) : (
            skill.agents!.map((a) => (
              <Button key={a.id} kind="secondary" size="sm" icon="Cpu" onClick={() => router.push(`/agents/${a.id}?tab=skills`)}>
                {a.name}
              </Button>
            ))
          )}
        </div>
      </div>

      {skill.evidence_files && skill.evidence_files.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="File">{t("preview.evidence")}</SectionLabel>
          <div style={s.chips}>
            {skill.evidence_files.map((f) => <Badge key={f} mono icon="FileText">{f}</Badge>)}
          </div>
        </div>
      )}

      <div style={s.section}>
        <SectionLabel
          icon="FileText"
          right={
            !editing && (
              <Button kind="ghost" size="sm" icon="Edit" onClick={() => { setDraft(skill.body); setEditing(true); setShownVersion(null); }}>
                {t("preview.edit")}
              </Button>
            )
          }
        >
          {t("preview.bodyLabel")}
          {shownVersion != null && shownVersion !== skill.version ? ` · v${shownVersion}` : ""}
        </SectionLabel>
        {editing ? (
          <>
            <Textarea value={draft} onChange={setDraft} rows={16} mono />
            <div style={{ ...s.muted, marginTop: 6 }}>{t("preview.bodyHint")}</div>
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" loading={update.isPending} onClick={save}>{t("preview.save")}</Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>{t("preview.cancel")}</Button>
            </div>
          </>
        ) : (
          <div style={s.body}>
            <Markdown>{shown}</Markdown>
          </div>
        )}
      </div>

      <div style={s.section}>
        <SectionLabel icon="History">{t("preview.versions")}</SectionLabel>
        {(versions ?? []).map((v) => (
          <div key={v.version} style={s.verRow}>
            <MonoLink onClick={() => setShownVersion(v.version)}>v{v.version}</MonoLink>
            {v.version === skill.version && <Badge color="var(--ok)" bg="var(--ok-bg)" dot>current</Badge>}
            <span style={s.muted}>{new Date(v.created_at).toLocaleString()}</span>
            <span style={{ ...s.muted, marginLeft: "auto" }}>{v.body.split("\n").length} lines</span>
          </div>
        ))}
      </div>
    </div>
  );
}
