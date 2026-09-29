/* hooks/knowledge.ts — React Query hooks for the knowledge screens that feed an
   agent's prompt: Skills (+ community catalog), Conventions, Memory and Project
   Context specs. Backed by the mock API (mock-server/) until the real server
   modules land; shapes follow @devdigest/shared (Skill, ConventionCandidate,
   MemoryItem, SpecFile, IndexStatus) plus the persisted ids/timestamps. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Skill,
  SkillType,
  CommunitySkill,
  ConventionCandidate,
  MemoryItem,
  SpecFile,
  IndexStatus,
} from "@devdigest/shared";

// ---------------------------------------------------------------- types ----
/** A skill plus the agents it is linked to (list/detail endpoints). */
export interface SkillRecord extends Skill {
  created_at?: string;
  updated_at?: string;
  agents?: { id: string; name: string }[];
}

export interface SkillVersionRecord {
  skill_id: string;
  version: number;
  body: string;
  created_at: string;
}

/** A persisted memory entry (MemoryItem + identity/timestamps). */
export interface MemoryRecord extends MemoryItem {
  id: string;
  repo: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface MemoryFilter {
  q?: string;
  scope?: string[];
  kind?: string[];
}

// ---------------------------------------------------------------- skills ----
export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: () => api.get<SkillRecord[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<SkillRecord>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersionRecord[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

function useInvalidateSkills() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["skills"] });
    qc.invalidateQueries({ queryKey: ["skill"] });
    qc.invalidateQueries({ queryKey: ["skill-versions"] });
    qc.invalidateQueries({ queryKey: ["agents"] });
    qc.invalidateQueries({ queryKey: ["agent-skills"] });
  };
}

export function useCreateSkill() {
  const invalidate = useInvalidateSkills();
  return useMutation({
    mutationFn: (input: { name?: string; body: string; type?: SkillType }) => api.post<SkillRecord>("/skills", input),
    onSuccess: invalidate,
  });
}

export function useImportSkillUrl() {
  const invalidate = useInvalidateSkills();
  return useMutation({
    mutationFn: (url: string) => api.post<SkillRecord>("/skills/import-url", { url }),
    onSuccess: invalidate,
  });
}

export function useCommunitySkills(q: string, lang: string) {
  return useQuery({
    queryKey: ["community-skills", q, lang],
    queryFn: () =>
      api.get<CommunitySkill[]>(
        `/skills/community?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`,
      ),
  });
}

export function useImportCommunitySkill() {
  const invalidate = useInvalidateSkills();
  return useMutation({
    mutationFn: (name: string) => api.post<SkillRecord>("/skills/community/import", { name }),
    onSuccess: invalidate,
  });
}

export function useUpdateSkill() {
  const invalidate = useInvalidateSkills();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Skill, "body" | "enabled" | "name" | "description" | "type">> }) =>
      api.put<SkillRecord>(`/skills/${id}`, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteSkill() {
  const invalidate = useInvalidateSkills();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: invalidate,
  });
}

// ----------------------------------------------------------- conventions ----
export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionCandidate[]>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => qc.setQueryData(["conventions", repoId], data),
  });
}

export function useAcceptConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidateSkills = useInvalidateSkills();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ convention: ConventionCandidate; skill: SkillRecord }>(`/conventions/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
      invalidateSkills();
    },
  });
}

export function useDeleteConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/conventions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conventions", repoId] }),
  });
}

// ---------------------------------------------------------------- memory ----
export function useMemory(filter: MemoryFilter = {}) {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.scope?.length) params.set("scope", filter.scope.join(","));
  if (filter.kind?.length) params.set("kind", filter.kind.join(","));
  const qs = params.toString();
  return useQuery({
    queryKey: ["memory", qs],
    queryFn: () => api.get<MemoryRecord[]>(`/memory${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<MemoryRecord, "content" | "scope" | "kind"> & { repo?: string | null }) =>
      api.post<MemoryRecord>("/memory", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
}

export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<MemoryRecord, "content" | "scope" | "kind">> }) =>
      api.put<MemoryRecord>(`/memory/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
}

// ------------------------------------------------------- project context ----
export function useContextStatus(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["context-status", repoId],
    queryFn: () => api.get<IndexStatus>(`/repos/${repoId}/context/status`),
    enabled: !!repoId,
  });
}

export function useSaveSpec(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { path: string; content: string }) => api.put<SpecFile>(`/repos/${repoId}/context`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["context", repoId] });
      qc.invalidateQueries({ queryKey: ["context-status", repoId] });
    },
  });
}
