/* engine.js — the fake "reviewer": builds the real-shaped prompt for an agent
   (system prompt + linked skills + memory + specs + repo map + callers + diff),
   and produces run traces / grounded findings without calling any LLM. */
import { assemblePrompt, taskLine } from './prompt.js';
import { addedLines, elapsed, pick, scoreFor, tokens, uuid, verdictFor } from './util.js';

/** Unified diff text for a PR (what the model would see). */
export function diffText(pr) {
  return pr.files
    .map((f) => `diff --git a/${f.path} b/${f.path}\n--- a/${f.path}\n+++ b/${f.path}\n${f.patch ?? ''}`)
    .join('\n');
}

export function repoMapFor(repo) {
  return REPO_MAPS[repo.full_name] ?? `${repo.full_name}\n  src/index.ts\n    export function main(): Promise<void>`;
}

export function callersFor(pr) {
  if (pr.number === 482) {
    return [
      'src/config.ts: config',
      '  ← src/server.ts:14        app.listen({ port: config.port })',
      '  ← src/lib/redis.ts:9      new Redis(config.redisUrl, …)',
      '  ← src/middleware/ratelimit.ts:20  config.rateLimit.max / config.rateLimit.windowMs',
      'src/api/users.ts: listUsers(req, reply)',
      '  ← src/api/index.ts:31     app.get("/admin/users", listUsers)',
      '  ← src/api/index.ts:32     app.get("/public/users", { preHandler: rateLimit }, listUsers)',
    ].join('\n');
  }
  const f = pr.files[0];
  return f ? `${f.path}\n  ← src/index.ts:12  (1 caller)` : '';
}

/** Everything that goes into one agent's prompt for one PR. */
export function buildPrompt(state, pr, agent) {
  const repo = state.repos.find((r) => r.id === pr.repo_id);
  const skillIds = state.agentSkills[agent.id] ?? [];
  const skills = skillIds
    .map((id) => state.skills.find((s) => s.id === id))
    .filter((s) => s && s.enabled);
  const memory = state.memory
    .filter((m) => m.scope !== 'repo' || m.repo === repo?.full_name)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
  const specs = (state.context[pr.repo_id] ?? []).slice(0, 2);
  const useIntel = agent.repo_intel && state.indexState[pr.repo_id]?.status !== 'failed';

  const assembly = assemblePrompt({
    system: agent.system_prompt,
    skills: skills.map((s) => s.body),
    memory: memory.map((m) => m.content),
    specs: specs.map((s) => `# ${s.path}\n${s.content ?? ''}`),
    repoMap: useIntel && repo ? repoMapFor(repo) : undefined,
    callers: useIntel ? callersFor(pr) : undefined,
    prDescription: pr.body ?? undefined,
    diff: diffText(pr),
    task: taskLine(pr),
  });
  return { assembly, skills, memory, specs };
}

/** Log lines + tool calls a run emits, in order. `review` may be null (failed). */
export function runScript(state, pr, agent, prompt, review) {
  const tIn = tokens(prompt.assembly.system) + tokens(prompt.assembly.user);
  const llmMs = 4200 + (tIn % 3000);
  const steps = [
    { ms: 0, kind: 'info', msg: `run started · ${agent.name} · ${agent.provider}/${agent.model} · strategy=${agent.strategy}` },
    { ms: 180, kind: 'tool', msg: `git.diff ${pr.base}...${pr.branch} → ${pr.files.length} files (+${pr.additions} −${pr.deletions})`, tool: { tool: 'git.diff', args: `${pr.base}...${pr.branch}`, meta: `${pr.files.length} files`, ms: 42 } },
  ];
  if (prompt.assembly.repo_map) {
    steps.push({ ms: 420, kind: 'tool', msg: `repo_intel.getRepoMap(budget=1500) → ${tokens(prompt.assembly.repo_map)} tokens`, tool: { tool: 'repo_intel.getRepoMap', args: 'budget=1500', meta: `${tokens(prompt.assembly.repo_map)} tok`, ms: 118 } });
    steps.push({ ms: 640, kind: 'tool', msg: `repo_intel.getCallerSignatures(limit=10) → ${prompt.assembly.callers?.split('\n').filter((l) => l.includes('←')).length ?? 0} callers`, tool: { tool: 'repo_intel.getCallerSignatures', args: 'limit=10', meta: 'callers digest', ms: 64 } });
  } else {
    steps.push({ ms: 420, kind: 'info', msg: 'repo-intel skipped (disabled for this agent)' });
  }
  steps.push({ ms: 900, kind: 'info', msg: `skills attached: ${prompt.skills.length}${prompt.skills.length ? ` (${prompt.skills.map((s) => s.name).join(', ')})` : ''}` });
  steps.push({ ms: 1100, kind: 'tool', msg: `memory.search(k=4) → ${prompt.memory.length} items`, tool: { tool: 'memory.search', args: 'k=4', meta: `${prompt.memory.length} hits`, ms: 31 } });
  steps.push({ ms: 1300, kind: 'tool', msg: `context.readSpecs → ${prompt.specs.map((s) => s.path).join(', ') || 'none'}`, tool: { tool: 'context.readSpecs', args: '.devdigest/specs', meta: `${prompt.specs.length} specs`, ms: 12 } });
  steps.push({ ms: 1500, kind: 'info', msg: `prompt assembled · ~${tIn.toLocaleString('en-US')} tokens in` });
  steps.push({ ms: 1700, kind: 'tool', msg: `llm.completeStructured(${agent.model}, schema=Review) …`, tool: { tool: 'llm.completeStructured', args: `${agent.provider}/${agent.model}`, meta: 'strict json_schema', ms: llmMs } });
  if (!review) return { steps, tIn, llmMs };
  const tOut = tokens(JSON.stringify(review.raw));
  steps.push({ ms: 1700 + llmMs, kind: 'info', msg: `model returned ${review.raw.findings.length} findings · ${tOut} tokens out` });
  steps.push({ ms: 1900 + llmMs, kind: 'tool', msg: `grounding.check → ${review.grounding}${review.dropped ? ` (dropped ${review.dropped}: lines not in diff)` : ''}`, tool: { tool: 'grounding.check', args: 'findings vs diff hunks', meta: review.grounding, ms: 3 } });
  steps.push({ ms: 2100 + llmMs, kind: 'result', msg: `review saved · verdict=${review.verdict} · score=${review.score} · ${review.findings.length} findings` });
  return { steps, tIn, tOut, llmMs };
}

export function traceFrom(state, pr, agent, prompt, script, review, extra = {}) {
  const last = script.steps[script.steps.length - 1];
  return {
    config: {
      agent: agent.name,
      version: `v${agent.version}`,
      provider: agent.provider,
      model: agent.model,
      pr: pr.number,
      source: 'local',
    },
    stats: {
      duration_ms: extra.duration_ms ?? last.ms + 120,
      tokens_in: script.tIn,
      tokens_out: script.tOut ?? 0,
      findings: review?.findings.length ?? 0,
      grounding: review?.grounding ?? '—',
    },
    prompt_assembly: prompt.assembly,
    tool_calls: script.steps.filter((s) => s.tool).map((s) => s.tool),
    raw_output: review ? JSON.stringify(review.raw, null, 2) : extra.raw_output ?? '',
    memory_pulled: prompt.memory.map((m) => ({ pr: m.sources?.[0]?.pr ?? null, text: m.content })),
    specs_read: prompt.specs.map((s) => s.path),
    log: (extra.log ?? script.steps).map((s) => ({ t: elapsed(s.ms), kind: s.kind, msg: s.msg })),
  };
}

// ------------------------------------------------------------ findings ----
const TEMPLATES = {
  security: [
    { severity: 'WARNING', category: 'security', title: 'Untrusted input reaches a sensitive sink without validation', rationale: 'The value comes straight from the request and is used without a schema check. A crafted payload can change behaviour here.', suggestion: 'Validate the input with a zod schema at the route boundary and reject unknown shapes.' },
    { severity: 'CRITICAL', category: 'security', title: 'Authorization check missing on object access', rationale: 'The handler loads the record by id but never checks that it belongs to the caller (BOLA).', suggestion: 'Scope the query by the authenticated account id.' },
    { severity: 'SUGGESTION', category: 'security', title: 'Error message leaks internal details', rationale: 'The raw error is returned to the client, exposing stack/driver details.', suggestion: 'Return a generic message and log the error server-side.' },
  ],
  perf: [
    { severity: 'WARNING', category: 'perf', title: 'Query executed inside a loop (N+1)', rationale: 'Each iteration issues a separate round-trip; latency grows linearly with the result size.', suggestion: 'Collect the ids and fetch in one `inArray` query, then group in memory.' },
    { severity: 'SUGGESTION', category: 'perf', title: 'Result set is not bounded', rationale: 'The query has no `.limit()`; large tenants will load everything into memory.', suggestion: 'Add pagination with a hard cap (200).' },
  ],
  general: [
    { severity: 'WARNING', category: 'bug', title: 'Missing await on async call', rationale: 'The promise is not awaited, so errors become unhandled rejections and the response may be sent before the write completes.', suggestion: 'Add `await` (or return the promise).' },
    { severity: 'SUGGESTION', category: 'style', title: 'Magic number should be a named constant', rationale: 'The literal hides its meaning and is duplicated elsewhere.', suggestion: 'Extract to a constant in `constants.ts`.' },
    { severity: 'WARNING', category: 'test', title: 'New behaviour has no test', rationale: 'This branch changes observable behaviour but no test covers it.', suggestion: 'Add a unit test for the new branch.' },
  ],
};

function flavourOf(agent) {
  const n = agent.name.toLowerCase();
  if (n.includes('secur')) return 'security';
  if (n.includes('perf')) return 'perf';
  return 'general';
}

/**
 * Produce a grounded review for a fresh (simulated) run. Uses the PR's canned
 * findings when available (PR #482), otherwise templates anchored on real
 * added lines of the diff. One extra "hallucinated" finding is always dropped
 * by the grounding gate to show the gate working.
 */
export function generateReview(state, pr, agent) {
  const flavour = flavourOf(agent);
  const canned = (state.cannedFindings[pr.id]?.[flavour] ?? []).map((f) => ({ ...f }));
  let findings = canned;
  if (findings.length === 0) {
    const added = pr.files.flatMap((f) => addedLines(f.patch).map((l) => ({ ...l, file: f.path })));
    const pool = TEMPLATES[flavour];
    const count = added.length === 0 ? 0 : Math.min(pool.length, 1 + (pr.number % 3));
    findings = [];
    for (let i = 0; i < count; i++) {
      const at = pick(added, `${agent.id}:${pr.id}:${i}`);
      const tpl = pool[i % pool.length];
      findings.push({ ...tpl, file: at.file, start_line: at.line, end_line: at.line, confidence: 0.7 + ((pr.number + i) % 25) / 100, kind: 'finding' });
    }
  }
  const hallucinated = {
    severity: 'SUGGESTION', category: 'style', title: 'Consider renaming helper for clarity',
    file: 'src/utils/legacy.ts', start_line: 999, end_line: 999,
    rationale: 'Cited a file that is not part of this diff.', suggestion: null, confidence: 0.41, kind: 'finding',
  };
  const raw = {
    verdict: verdictFor(findings),
    summary: summaryFor(flavour, findings),
    score: 42, // the model's own score — ignored, recomputed below
    findings: [...findings, hallucinated],
  };
  return {
    raw,
    findings,
    dropped: 1,
    grounding: `${findings.length}/${findings.length + 1} passed`,
    verdict: verdictFor(findings),
    score: scoreFor(findings),
    summary: raw.summary,
  };
}

function summaryFor(flavour, findings) {
  if (findings.length === 0) return 'No issues worth raising — the change is small, well-scoped and covered by tests.';
  const crit = findings.filter((f) => f.severity === 'CRITICAL').length;
  const lead = {
    security: 'Security pass',
    perf: 'Performance pass',
    general: 'Correctness pass',
  }[flavour];
  return `${lead}: ${findings.length} finding(s)${crit ? `, ${crit} blocking` : ''}. ${findings[0].title}.`;
}

/** Persist a generated review as a ReviewRecord. */
export function toReviewRecord(pr, agent, runId, gen, createdAt) {
  const id = uuid();
  return {
    id,
    pr_id: pr.id,
    agent_id: agent.id,
    run_id: runId,
    agent_name: agent.name,
    kind: 'review',
    verdict: gen.verdict,
    summary: gen.summary,
    score: gen.score,
    model: `${agent.provider}/${agent.model}`,
    grounding: gen.grounding,
    created_at: createdAt,
    findings: gen.findings.map((f) => ({
      id: uuid(),
      review_id: id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      file: f.file,
      start_line: f.start_line,
      end_line: f.end_line,
      rationale: f.rationale,
      suggestion: f.suggestion ?? null,
      confidence: f.confidence,
      kind: f.kind ?? 'finding',
      trifecta_components: f.trifecta_components ?? null,
      evidence: f.evidence ?? null,
      accepted_at: f.accepted_at ?? null,
      dismissed_at: f.dismissed_at ?? null,
    })),
  };
}

const REPO_MAPS = {
  'acme/payments-api': `acme/payments-api (412 files · top-ranked symbols)
src/app.ts
  export async function buildApp(opts?: AppOptions): Promise<FastifyInstance>
src/config.ts
  export const config: { port; databaseUrl; redisUrl; logLevel }
src/lib/errors.ts
  export class AppError extends Error
  export class NotFoundError extends AppError
  export class ValidationError extends AppError
src/lib/money.ts
  export type Cents = number & { __brand: 'cents' }
  export function toCents(amount: string): Cents
src/lib/stripe.ts
  export async function createCharge(input: ChargeInput): Promise<Charge>
src/repositories/customers.ts
  export async function findCustomer(id: string): Promise<Customer | null>
  export async function listCustomers(q: ListQuery): Promise<Customer[]>
src/repositories/invoices.ts
  export async function latestInvoice(customerId: string): Promise<Invoice | null>
src/api/users.ts
  export async function listUsers(req, reply)
  export async function getUser(req, reply)
src/api/public/webhooks.ts
  export async function webhookRoutes(app: FastifyInstance)`,
  'acme/web-dashboard': `acme/web-dashboard (1,880 files · partial index)
src/lib/hooks/invoices.ts
  export function useInvoices(filter: InvoiceFilter)
src/components/InvoiceTable/InvoiceTable.tsx
  export function InvoiceTable(props: InvoiceTableProps)
src/app/layout.tsx
  export default function RootLayout({ children })`,
};

export { uuid };
