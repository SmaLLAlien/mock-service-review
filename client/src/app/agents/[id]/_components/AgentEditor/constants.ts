import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `agents` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Editor tabs: config, linked skills, assembled-prompt preview, version history. */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "skills", labelKey: "editor.tabs.skills", icon: "Sparkles" },
  { key: "prompt", labelKey: "editor.tabs.prompt", icon: "FileText" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "History" },
];

/** Tab keys accepted in ?tab= (anything else falls back to config). */
export const TAB_KEYS: readonly string[] = TABS.map((t) => t.key);
