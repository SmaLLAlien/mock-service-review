/* AddSkillDrawer — import a skill from pasted Markdown ("file"), a URL, or the
   vetted community catalog. URL/community imports land disabled ("needs
   vetting") because their body is untrusted data. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Drawer, EmptyState, FormField, SelectInput, Tabs, TextInput, Textarea } from "@devdigest/ui";
import { useCommunitySkills, useCreateSkill, useImportCommunitySkill, useImportSkillUrl } from "@/lib/hooks/knowledge";
import { notify } from "@/lib/toast";
import { s } from "./styles";

export type AddTab = "file" | "url" | "community";

const LANGS = ["", "Any", "TypeScript", "Go", "Python", "SQL", "HCL"];

export function AddSkillDrawer({
  initialTab,
  onClose,
  onCreated,
}: {
  initialTab: AddTab;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const [tab, setTab] = React.useState<AddTab>(initialTab);
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [q, setQ] = React.useState("");
  const [lang, setLang] = React.useState("");
  const create = useCreateSkill();
  const importUrl = useImportSkillUrl();
  const importCommunity = useImportCommunitySkill();
  const { data: community, isError, refetch } = useCommunitySkills(q, lang);
  const [err, setErr] = React.useState<string | null>(null);

  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : t("drawer.importFailed"));

  return (
    <Drawer width={620} title={t("drawer.title")} subtitle={t("drawer.subtitle")} onClose={onClose}>
      <Tabs
        value={tab}
        onChange={(k) => { setTab(k as AddTab); setErr(null); }}
        pad="0 24px"
        tabs={[
          { key: "file", label: t("drawer.tabs.file"), icon: "Upload" },
          { key: "url", label: t("drawer.tabs.url"), icon: "Link" },
          { key: "community", label: t("drawer.tabs.community"), icon: "Globe" },
        ]}
      />
      <div style={s.body}>
        {tab === "file" && (
          <>
            <FormField label={t("file.nameLabel")} hint={t("file.nameHint")}>
              <TextInput value={name} onChange={setName} placeholder={t("file.namePlaceholder")} mono />
            </FormField>
            <FormField label={t("file.bodyLabel")} hint={t("file.bodyHint")} required>
              <Textarea value={body} onChange={setBody} rows={14} mono placeholder={t("file.bodyPlaceholder")} />
            </FormField>
            <div>
              <Button
                kind="primary"
                icon="Upload"
                loading={create.isPending}
                disabled={!body.trim()}
                onClick={() =>
                  create.mutate(
                    { name: name || undefined, body },
                    { onSuccess: (sk) => { notify.success(t("file.success", { name: sk.name })); onCreated(sk.id); }, onError: fail },
                  )
                }
              >
                {create.isPending ? t("file.importing") : t("file.import")}
              </Button>
            </div>
          </>
        )}

        {tab === "url" && (
          <>
            <FormField label={t("url.label")} hint={t("url.hint")} required>
              <TextInput value={url} onChange={setUrl} placeholder={t("url.placeholder")} mono />
            </FormField>
            <div>
              <Button
                kind="primary"
                icon="Link"
                loading={importUrl.isPending}
                disabled={!url.trim()}
                onClick={() =>
                  importUrl.mutate(url, {
                    onSuccess: (sk) => { notify.success(t("url.success", { name: sk.name })); onCreated(sk.id); },
                    onError: fail,
                  })
                }
              >
                {importUrl.isPending ? t("url.fetching") : t("url.import")}
              </Button>
            </div>
          </>
        )}

        {tab === "community" && (
          <>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <TextInput value={q} onChange={setQ} placeholder={t("community.searchPlaceholder")} />
              </div>
              <div style={{ width: 170 }}>
                <SelectInput
                  mono={false}
                  value={lang}
                  onChange={setLang}
                  options={LANGS.map((l) => ({ value: l, label: l || t("community.allLanguages") }))}
                />
              </div>
            </div>
            {isError && (
              <div style={s.error}>
                {t("community.loadError")} · <Button kind="ghost" size="sm" onClick={() => refetch()}>{t("community.retry")}</Button>
              </div>
            )}
            {community && community.length === 0 && (
              <EmptyState icon="Search" title={t("community.noMatch.title")} body={t("community.noMatch.body")} />
            )}
            {(community ?? []).map((c) => (
              <div key={c.name} style={s.card}>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={s.cardName}>{c.name}</div>
                  <div style={s.cardDesc}>{c.desc}</div>
                  <div style={s.cardMeta}>
                    <span className="mono">{c.repo}</span>
                    <span>★ {c.stars.toLocaleString("en-US")}</span>
                    <Badge>{c.lang}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  icon="Plus"
                  loading={importCommunity.isPending && importCommunity.variables === c.name}
                  onClick={() =>
                    importCommunity.mutate(c.name, {
                      onSuccess: (sk) => { notify.success(t("url.success", { name: sk.name })); onCreated(sk.id); },
                      onError: fail,
                    })
                  }
                >
                  {t("community.import")}
                </Button>
              </div>
            ))}
          </>
        )}
        {err && <div style={s.error}>{err}</div>}
      </div>
    </Drawer>
  );
}
