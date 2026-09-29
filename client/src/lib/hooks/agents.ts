/* hooks/agents.ts — React Query hooks for the A2 Agents tab + Agent Editor. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Agent, ModelInfo, Provider, ReviewStrategy } from "@devdigest/shared";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
}

export function useAgent(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
    enabled: !!id,
  });
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  enabled?: boolean;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => api.post<Agent>("/agents", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export interface UpdateAgentInput {
  id: string;
  patch: Partial<
    Pick<
      Agent,
      | "name"
      | "description"
      | "provider"
      | "model"
      | "system_prompt"
      | "output_schema"
      | "strategy"
      | "ci_fail_on"
      | "repo_intel"
      | "enabled"
    >
  >;
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateAgentInput) => api.put<Agent>(`/agents/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agent", data.id], data);
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/agents/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.removeQueries({ queryKey: ["agent", id] });
    },
  });
}

/** Dynamic model list for a provider (editor model picker). */
export function useProviderModels(provider: Provider | null | undefined) {
  return useQuery({
    queryKey: ["provider-models", provider],
    queryFn: () => api.get<ModelInfo[]>(`/providers/${provider}/models`),
    enabled: !!provider,
    staleTime: 5 * 60_000,
  });
}

// ---- Linked skills (GET/POST /agents/:id/skills) ----
export interface AgentSkillLinkRecord {
  agent_id: string;
  skill_id: string;
  order: number;
  skill?: {
    id: string;
    name: string;
    description: string;
    type: string;
    source: string;
    enabled: boolean;
    version: number;
  } | null;
}

export function useAgentSkills(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", id],
    queryFn: () => api.get<AgentSkillLinkRecord[]>(`/agents/${id}/skills`),
    enabled: !!id,
  });
}

/** Replace the ordered set of skills linked to an agent. */
export function useSetAgentSkills(id: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skillIds: string[]) =>
      api.post<AgentSkillLinkRecord[]>(`/agents/${id}/skills`, { skill_ids: skillIds }),
    onSuccess: (data) => {
      qc.setQueryData(["agent-skills", id], data);
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent", id] });
      qc.invalidateQueries({ queryKey: ["agent-versions", id] });
      qc.invalidateQueries({ queryKey: ["agent-prompt", id] });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

// ---- Version history (GET /agents/:id/versions) ----
export interface AgentVersionRecord {
  agent_id: string;
  version: number;
  created_at: string;
  config: {
    provider: Provider;
    model: string;
    system_prompt: string;
    output_schema?: unknown;
    strategy: ReviewStrategy;
    ci_fail_on: string;
    repo_intel: boolean;
    skills: string[];
  };
}

export function useAgentVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-versions", id],
    queryFn: () => api.get<AgentVersionRecord[]>(`/agents/${id}/versions`),
    enabled: !!id,
  });
}

// ---- Prompt preview: exactly what the model would receive for a PR ----
export interface PromptPreview {
  pr: { id: string; number: number; title: string };
  assembly: {
    system: string;
    skills: string | null;
    memory: string | null;
    specs: string | null;
    callers: string | null;
    repo_map: string | null;
    pr_description: string | null;
    user: string;
  };
  skills: string[];
  memory: string[];
  specs: string[];
}

export function usePromptPreview(id: string | null | undefined, prId?: string | null) {
  return useQuery({
    queryKey: ["agent-prompt", id, prId ?? null],
    queryFn: () =>
      api.get<PromptPreview>(`/agents/${id}/prompt-preview${prId ? `?prId=${prId}` : ""}`),
    enabled: !!id,
  });
}
