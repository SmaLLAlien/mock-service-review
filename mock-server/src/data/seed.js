/* seed.js — builds the complete in-memory demo state. Called at startup and
   by POST /__reset. Every screen of the client has data to show. */
import { daysAgo, fakeSha, hoursAgo, minutesAgo, prFile, uuid } from '../lib/util.js';
import {
  buildPrompt,
  runScript,
  traceFrom,
  toReviewRecord,
} from '../lib/engine.js';
import { scoreFor, verdictFor, elapsed } from '../lib/util.js';
import { PR482_BODY, PR482_FILES, lineOf } from './pr482.js';
import { SKILLS, COMMUNITY_SKILLS, CONVENTIONS, MEMORY, SPECS } from './knowledge.js';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
} from './agent-prompts.js';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

// ---------------------------------------------------------------- models ----
export const MODELS = {
  openrouter: [
    ['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 0.14, 0.28, 128000],
    ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 0.55, 2.19, 128000],
    ['anthropic/claude-sonnet-4.6', 'Claude Sonnet 4.6', 3, 15, 200000],
    ['anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 1, 5, 200000],
    ['openai/gpt-4.1', 'GPT-4.1', 2, 8, 1047576],
    ['openai/gpt-4.1-mini', 'GPT-4.1 mini', 0.4, 1.6, 1047576],
    ['google/gemini-2.5-flash', 'Gemini 2.5 Flash', 0.3, 2.5, 1048576],
    ['z-ai/glm-4.6', 'GLM 4.6', 0.6, 2.2, 202752],
    ['minimax/minimax-m2', 'MiniMax M2', 0.3, 1.2, 204800],
  ].map(([id, label, i, o, ctx]) => ({ id, provider: 'openrouter', label, pricing: { promptPerM: i, completionPerM: o }, contextLength: ctx })),
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5', 'o4-mini'].map((id) => ({ id, provider: 'openai', label: id })),
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-1', 'claude-haiku-4-5'].map((id) => ({ id, provider: 'anthropic', label: id })),
};

// ------------------------------------------------------------- helpers ----
function mkRepo(owner, name, extra = {}) {
  return {
    id: uuid(),
    workspace_id: WORKSPACE_ID,
    owner,
    name,
    full_name: `${owner}/${name}`,
    default_branch: 'main',
    clone_path: `~/.devdigest/workspace/${owner}/${name}`,
    last_polled_at: minutesAgo(12),
    created_by: USER_ID,
    ...extra,
  };
}

/** A tiny but real unified diff for a new or modified file. */
function newFilePatch(lines) {
  return `@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join('\n')}`;
}
function modPatch(start, ctxBefore, removed, added, ctxAfter = []) {
  const oldLen = ctxBefore.length + removed.length + ctxAfter.length;
  const newLen = ctxBefore.length + added.length + ctxAfter.length;
  const body = [
    ...ctxBefore.map((l) => ` ${l}`),
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
    ...ctxAfter.map((l) => ` ${l}`),
  ];
  return `@@ -${start},${oldLen} +${start},${newLen} @@\n${body.join('\n')}`;
}

function mkPr(repo, p) {
  const files = p.files;
  const additions = files.reduce((a, f) => a + f.additions, 0);
  const deletions = files.reduce((a, f) => a + f.deletions, 0);
  return {
    id: uuid(),
    repo_id: repo.id,
    number: p.number,
    title: p.title,
    author: p.author,
    branch: p.branch,
    base: 'main',
    head_sha: fakeSha(`${repo.full_name}#${p.number}`),
    additions,
    deletions,
    files_count: p.files_count ?? files.length,
    status: p.status,
    opened_at: p.opened_at,
    updated_at: p.updated_at,
    score: null,
    body: p.body ?? null,
    files,
    commits: p.commits ?? [
      { sha: fakeSha(`${p.number}:c1`), message: p.title, author: p.author, committed_at: p.updated_at },
    ],
    linked_issue: p.linked_issue ?? null,
  };
}

// ------------------------------------------------------------ build ----
export function buildState() {
  const state = {
    workspace: { id: WORKSPACE_ID, name: 'default', user: { id: USER_ID, email: 'you@local', name: 'You' } },
    settings: {
      polling_interval_min: 5,
      theme: 'dark',
      density: 'regular',
      sync_to_folder: true,
      automatic_reviews: false,
      feature_models: {
        conventions: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.6' },
      },
    },
    secrets: { openai: true, anthropic: false, openrouter: true, github: true },
    repos: [],
    pulls: [],
    comments: {},
    reviews: [],
    runs: [],
    traces: {},
    runEvents: {},
    agents: [],
    agentVersions: {},
    agentSkills: {},
    skills: [],
    skillVersions: {},
    communitySkills: COMMUNITY_SKILLS,
    conventions: {},
    memory: [],
    context: {},
    contextStatus: {},
    indexState: {},
    cannedFindings: {},
    commentSeq: 9000,
  };

  // ---- repos ----
  const payments = mkRepo('acme', 'payments-api');
  const dashboard = mkRepo('acme', 'web-dashboard', { last_polled_at: hoursAgo(3) });
  const mobile = mkRepo('acme', 'mobile-sdk', { clone_path: null, last_polled_at: null });
  state.repos.push(payments, dashboard, mobile);

  state.indexState[payments.id] = { status: 'full', filesIndexed: 412, filesSkipped: 3, lastIndexedSha: fakeSha('payments-head'), updatedAt: minutesAgo(25) };
  state.indexState[dashboard.id] = { status: 'partial', filesIndexed: 1880, filesSkipped: 312, lastIndexedSha: fakeSha('dash-head'), updatedAt: hoursAgo(3), reason: 'Soft time budget reached (110s) — 312 files deferred to the next incremental run.' };
  state.indexState[mobile.id] = { status: 'degraded', filesIndexed: 0, filesSkipped: 0, lastIndexedSha: '', updatedAt: daysAgo(2), degraded: true, degradedReason: 'Repository is not cloned yet — using diff-only context.', reason: 'not_cloned' };

  // ---- skills ----
  const skillByKey = {};
  for (const s of SKILLS) {
    const id = uuid();
    const latest = s.versions[s.versions.length - 1];
    const skill = {
      id,
      name: s.name,
      description: s.description,
      type: s.type,
      source: s.source,
      body: latest.body,
      enabled: s.enabled,
      version: s.versions.length,
      evidence_files: s.evidence_files,
      created_at: s.versions[0].at,
      updated_at: latest.at,
    };
    state.skills.push(skill);
    state.skillVersions[id] = s.versions.map((v, i) => ({ skill_id: id, version: i + 1, body: v.body, created_at: v.at }));
    skillByKey[s.key] = skill;
  }

  // ---- agents ----
  const agentDefs = [
    { key: 'general', name: 'General Reviewer', description: 'Reviews a PR diff for bugs, correctness, and clarity.', provider: 'openrouter', model: 'deepseek/deepseek-v4-flash', prompt: GENERAL_REVIEWER_PROMPT, enabled: true, strategy: 'single-pass', ci: 'critical', intel: true, skills: ['rubric', 'errors', 'tests'], versions: 3 },
    { key: 'security', name: 'Security Reviewer', description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.', provider: 'openrouter', model: 'deepseek/deepseek-v4-pro', prompt: SECURITY_REVIEWER_PROMPT, enabled: true, strategy: 'auto', ci: 'critical', intel: true, skills: ['secrets', 'owasp', 'rubric'], versions: 4 },
    { key: 'perf', name: 'Performance Reviewer', description: 'Catches N+1 queries, missing indexes, and hot-path allocations.', provider: 'openrouter', model: 'deepseek/deepseek-v4-flash', prompt: PERFORMANCE_REVIEWER_PROMPT, enabled: true, strategy: 'single-pass', ci: 'warning', intel: true, skills: ['drizzle'], versions: 2 },
    { key: 'mentor', name: 'Mentor', description: 'Explains the "why" behind findings for junior engineers — friendly tone.', provider: 'anthropic', model: 'claude-sonnet-4-6', prompt: '# Role\nYou are a patient senior engineer mentoring the PR author. For every issue you report, explain WHY it matters and link the concept. Prefer SUGGESTION severity unless the defect is real.\n\n# Verdict\nNo findings ⇒ approve.', enabled: false, strategy: 'single-pass', ci: 'never', intel: false, skills: ['rubric'], versions: 1 },
    { key: 'arch', name: 'Architecture Reviewer', description: 'Checks layering (api → services → repositories) and module boundaries.', provider: 'openai', model: 'gpt-4.1', prompt: '# Role\nYou review structural changes: layering, module boundaries, dependency direction, public API shape. Ignore style.\n\n# Severity\nCRITICAL only for a boundary violation that will spread (e.g. route touching tables directly).\n\n# Verdict\nNo findings ⇒ approve.', enabled: false, strategy: 'map-reduce', ci: 'warning', intel: true, skills: [], versions: 2 },
  ];
  const agentByKey = {};
  for (const d of agentDefs) {
    const id = uuid();
    const agent = {
      id,
      name: d.name,
      description: d.description,
      provider: d.provider,
      model: d.model,
      system_prompt: d.prompt,
      output_schema: null,
      enabled: d.enabled,
      version: d.versions,
      strategy: d.strategy,
      ci_fail_on: d.ci,
      repo_intel: d.intel,
    };
    state.agents.push(agent);
    agentByKey[d.key] = agent;
    const skillIds = d.skills.map((k) => skillByKey[k].id);
    state.agentSkills[id] = skillIds;
    state.agentVersions[id] = Array.from({ length: d.versions }, (_, i) => ({
      agent_id: id,
      version: i + 1,
      created_at: daysAgo((d.versions - i) * 7),
      config: {
        provider: d.provider,
        model: i === 0 && d.key === 'security' ? 'deepseek/deepseek-v4-flash' : d.model,
        system_prompt: i === d.versions - 1 ? d.prompt : `${d.prompt.split('\n').slice(0, 12).join('\n')}\n…(v${i + 1})`,
        output_schema: null,
        strategy: i === 0 ? 'single-pass' : d.strategy,
        ci_fail_on: d.ci,
        repo_intel: d.intel,
        skills: skillIds.slice(0, Math.max(0, skillIds.length - (d.versions - 1 - i))),
      },
    }));
  }

  // ---- knowledge ----
  for (const repo of state.repos) {
    state.conventions[repo.id] = (CONVENTIONS[repo.full_name] ?? []).map((c) => ({ id: uuid(), ...c }));
    const specs = (SPECS[repo.full_name] ?? []).map((s) => ({
      path: s.path,
      content: s.content,
      size: Buffer.byteLength(s.content),
      updated_at: daysAgo(s.updatedDays),
    }));
    state.context[repo.id] = specs;
    state.contextStatus[repo.id] = specs.length
      ? { status: 'done', pct: 100, message: `${specs.length} spec files indexed`, chunks_indexed: specs.length * 7 }
      : { status: 'idle', pct: 0, message: 'No spec files yet', chunks_indexed: 0 };
  }
  state.memory = MEMORY.map((m) => ({
    id: uuid(),
    content: m.content,
    scope: m.scope,
    kind: m.kind,
    confidence: m.confidence,
    sources: m.sources,
    repo: m.repo,
    created_at: daysAgo(m.updatedDays + 10),
    updated_at: daysAgo(m.updatedDays),
    last_used_at: m.usedDays == null ? null : daysAgo(m.usedDays),
  }));

  // ---- pull requests: acme/payments-api ----
  const pr482 = mkPr(payments, {
    number: 482,
    title: 'Add rate limiting to public API endpoints',
    author: 'marisa.koch',
    branch: 'feat/rate-limit-public',
    status: 'reviewed',
    opened_at: daysAgo(2),
    updated_at: hoursAgo(3),
    body: PR482_BODY,
    files: PR482_FILES,
    commits: [
      { sha: fakeSha('482:1'), message: 'Add token-bucket rate limiter middleware', author: 'marisa.koch', committed_at: daysAgo(2) },
      { sha: fakeSha('482:2'), message: 'Apply limiter to public routes + partner forward webhook', author: 'marisa.koch', committed_at: daysAgo(1) },
      { sha: fakeSha('482:3'), message: 'Attach orgs to users list; 404 on missing user', author: 'marisa.koch', committed_at: hoursAgo(20) },
      { sha: fakeSha('482:4'), message: 'test: rate limiter + README section', author: 'dkim', committed_at: hoursAgo(5) },
    ],
    linked_issue: { number: 468, title: 'Scraper bursts degrade checkout (INC-2291)', state: 'open', body: 'We need per-client limits on /public/* before Black Friday.' },
  });
  pr482.head_sha = pr482.commits[3].sha;

  const others = [
    { number: 490, title: 'Refactor customer service into repository layer', author: 'dkim', branch: 'refactor/customer-repo', status: 'needs_review', opened_at: hoursAgo(9), updated_at: hoursAgo(1),
      body: 'Moves raw Drizzle queries out of `CustomerService` into `src/repositories/customers.ts`, per the architecture spec.',
      files: [
        prFile('src/repositories/customers.ts', newFilePatch(["import { db } from '../db';", "import { customers } from '../db/schema';", "import { eq, inArray } from 'drizzle-orm';", '', 'export async function findCustomer(id: string) {', '  const [row] = await db.select().from(customers).where(eq(customers.id, id));', '  return row ?? null;', '}', '', 'export async function findCustomers(ids: string[]) {', '  return db.select().from(customers).where(inArray(customers.id, ids));', '}'])),
        prFile('src/services/customer-service.ts', modPatch(1, ["import { findCustomer } from '../repositories/customers';"], ["import { db } from '../db';", "import { customers } from '../db/schema';"], [], ['', 'export class CustomerService {'])),
      ] },
    { number: 488, title: 'docs: webhook signing guide', author: 'priya.n', branch: 'docs/webhook-signing', status: 'needs_review', opened_at: hoursAgo(26), updated_at: hoursAgo(20),
      body: 'Adds a how-to for partners verifying our HMAC signatures.',
      files: [prFile('docs/webhooks.md', modPatch(12, ['## Verifying signatures', ''], [], ['Compute `HMAC_SHA256(secret, timestamp + "." + body)` and compare in constant time.', '', '```ts', "const expected = createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');", 'timingSafeEqual(Buffer.from(expected), Buffer.from(sig));', '```']))] },
    { number: 487, title: 'Migrate payouts job to BullMQ', author: 'tomas.r', branch: 'feat/bullmq-payouts', status: 'needs_review', opened_at: daysAgo(1), updated_at: hoursAgo(6), files_count: 14,
      body: 'Replaces the setInterval-based payout scheduler with a BullMQ repeatable job. Retries with exponential backoff; failed jobs land in a DLQ.',
      files: [
        prFile('src/jobs/payouts.ts', newFilePatch(["import { Queue, Worker } from 'bullmq';", "import { redis } from '../lib/redis';", "import { runPayouts } from '../services/payouts';", '', "export const payoutsQueue = new Queue('payouts', { connection: redis() });", '', "export const payoutsWorker = new Worker('payouts', async () => {", '  await runPayouts();', '}, { connection: redis(), concurrency: 1 });', '', "await payoutsQueue.add('nightly', {}, { repeat: { pattern: '0 2 * * *' }, attempts: 5, backoff: { type: 'exponential', delay: 30_000 } });"])),
        prFile('src/scheduler.ts', modPatch(3, ["import { runPayouts } from './services/payouts';"], ['setInterval(() => runPayouts().catch(console.error), 24 * 60 * 60 * 1000);'], ["// payouts moved to src/jobs/payouts.ts (BullMQ)"])),
        prFile('package.json', modPatch(20, ['    "drizzle-orm": "^0.38.0",'], [], ['    "bullmq": "^5.34.0",'], ['    "fastify": "^5.2.0",'])),
      ] },
    { number: 485, title: 'Fix currency rounding in invoice totals', author: 'marisa.koch', branch: 'fix/invoice-rounding', status: 'reviewed', opened_at: daysAgo(3), updated_at: daysAgo(1),
      body: 'Totals were computed with floats and rounded at the end, producing 1-cent drift on multi-line invoices. Now every line is converted to integer cents first.',
      files: [
        prFile('src/services/invoices.ts', modPatch(54, ['export function invoiceTotal(lines: InvoiceLine[]): Cents {'], ['  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);', '  return Math.round(total * 100) as Cents;'], ['  return lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.qty, 0) as Cents;'], ['}'])),
        prFile('test/invoices.test.ts', newFilePatch(["import { invoiceTotal } from '../src/services/invoices';", '', "it('does not drift by a cent on 3 × 0.1', () => {", "  expect(invoiceTotal([{ unitPrice: '0.10', qty: 3 }])).toBe(30);", '});'])),
      ] },
    { number: 479, title: 'Add idempotency keys to POST /charges', author: 'tomas.r', branch: 'feat/idempotency', status: 'stale', opened_at: daysAgo(6), updated_at: hoursAgo(30),
      body: 'Clients can send `Idempotency-Key`; repeated requests within 24h return the stored response.',
      files: [
        prFile('src/api/charges.ts', modPatch(20, ["app.post('/charges', async (req, reply) => {"], [], ["  const key = req.headers['idempotency-key'];", '  if (key) {', '    const cached = await idempotency.get(key);', '    if (cached) return reply.send(cached);', '  }'], ['  const charge = await createCharge(req.body);'])),
        prFile('src/lib/idempotency.ts', newFilePatch(['const store = new Map<string, unknown>();', 'export const idempotency = {', '  get: async (k: string) => store.get(k),', '  set: async (k: string, v: unknown) => void store.set(k, v),', '};'])),
      ] },
    { number: 476, title: 'Bump fastify to 5.2', author: 'renovate[bot]', branch: 'renovate/fastify-5.x', status: 'merged', opened_at: daysAgo(9), updated_at: daysAgo(7),
      body: 'Updates fastify from 5.1.0 to 5.2.0.',
      files: [prFile('package.json', modPatch(19, ['    "drizzle-orm": "^0.38.0",'], ['    "fastify": "^5.1.0",'], ['    "fastify": "^5.2.0",'], ['    "postgres": "^3.4.5",']))] },
    { number: 471, title: 'Experiment: GraphQL gateway', author: 'priya.n', branch: 'spike/graphql', status: 'closed', opened_at: daysAgo(15), updated_at: daysAgo(12),
      body: 'Spike — closing in favour of REST + OpenAPI (see ADR-012).',
      files: [prFile('src/graphql/schema.ts', newFilePatch(["import { makeSchema } from 'nexus';", 'export const schema = makeSchema({ types: [] });']))] },
  ].map((p) => mkPr(payments, p));

  const dashPrs = [
    { number: 214, title: 'Invoices table: server-side pagination', author: 'dkim', branch: 'feat/invoices-pagination', status: 'needs_review', opened_at: hoursAgo(15), updated_at: hoursAgo(2),
      body: 'Switches the invoices table to cursor pagination (50/page).',
      files: [prFile('src/components/InvoiceTable/InvoiceTable.tsx', modPatch(10, ['export function InvoiceTable() {'], ['  const { data } = useInvoices();'], ['  const [cursor, setCursor] = useState<string | null>(null);', '  const { data } = useInvoices({ cursor, limit: 50 });'], ['  return (']))] },
    { number: 212, title: 'Translate settings page (de)', author: 'lena.w', branch: 'i18n/settings-de', status: 'reviewed', opened_at: daysAgo(4), updated_at: daysAgo(2),
      body: 'Adds German strings for the settings page.',
      files: [prFile('messages/de/settings.json', newFilePatch(['{', '  "title": "Einstellungen",', '  "save": "Speichern"', '}']))] },
    { number: 209, title: 'Dark mode for charts', author: 'lena.w', branch: 'feat/dark-charts', status: 'merged', opened_at: daysAgo(10), updated_at: daysAgo(8),
      files: [prFile('src/components/Chart/theme.ts', newFilePatch(["export const darkChartTheme = { grid: 'var(--border)', text: 'var(--text-muted)' };"]))] },
  ].map((p) => mkPr(dashboard, p));

  const mobilePrs = [
    { number: 91, title: 'Retry failed uploads with backoff', author: 'sam.o', branch: 'feat/upload-retry', status: 'needs_review', opened_at: hoursAgo(40), updated_at: hoursAgo(30),
      files: [prFile('src/upload.ts', modPatch(30, ['export async function upload(file: Blob) {'], ['  return http.post(url, file);'], ['  return withRetry(() => http.post(url, file), { attempts: 3 });'], ['}']))] },
    { number: 88, title: 'Release 3.2.0', author: 'sam.o', branch: 'release/3.2.0', status: 'merged', opened_at: daysAgo(20), updated_at: daysAgo(19),
      files: [prFile('CHANGELOG.md', modPatch(1, ['# Changelog', ''], [], ['## 3.2.0', '- Offline queue for uploads', ''], ['## 3.1.4']))] },
  ].map((p) => mkPr(mobile, p));

  state.pulls.push(pr482, ...others, ...dashPrs, ...mobilePrs);

  // ---- PR #482: canned findings per agent flavour (used for fixtures AND for new runs) ----
  const L = (path, needle) => lineOf(path, needle);
  const canned482 = {
    general: [
      { severity: 'WARNING', category: 'bug', title: 'Off-by-one: bucket allows max + 1 requests per window', file: 'src/middleware/ratelimit.ts', start_line: L('src/middleware/ratelimit.ts', 'bucket.tokens >= 0'), end_line: L('src/middleware/ratelimit.ts', 'bucket.tokens -= 1'), rationale: 'The check is `tokens >= 0`, so a bucket with 0 tokens still admits one more request and goes negative. With `max = 100` the 101st request succeeds, contradicting the PRD acceptance criterion.', suggestion: '```ts\nif (bucket.tokens >= 1) {\n  bucket.tokens -= 1;\n```', confidence: 0.91, kind: 'finding' },
      { severity: 'WARNING', category: 'test', title: 'Test sleeps a real 61 seconds', file: 'test/ratelimit.test.ts', start_line: L('test/ratelimit.test.ts', 'setTimeout(r, 61_000)'), end_line: L('test/ratelimit.test.ts', 'setTimeout(r, 61_000)'), rationale: 'The refill test waits with a real timer, adding a minute to every CI run (and exceeding vitest\'s default 5s timeout — the test will fail).', suggestion: 'Use `vi.useFakeTimers()` and `vi.advanceTimersByTime(61_000)`, or inject a clock into the limiter.', confidence: 0.95, kind: 'finding' },
      { severity: 'SUGGESTION', category: 'bug', title: 'Redis client has no error listener', file: 'src/lib/redis.ts', start_line: L('src/lib/redis.ts', 'new Redis('), end_line: L('src/lib/redis.ts', 'new Redis('), rationale: 'ioredis emits `error` events on connection loss; without a listener Node prints an unhandled-error warning and the process may crash on some versions.', suggestion: "client.on('error', (err) => log.warn({ err }, 'redis error'));", confidence: 0.72, kind: 'finding' },
    ],
    security: [
      { severity: 'CRITICAL', category: 'security', title: 'Hardcoded Stripe secret key in commit', file: 'src/config.ts', start_line: L('src/config.ts', 'stripeSecretKey'), end_line: L('src/config.ts', 'stripeSecretKey'), rationale: 'A live-mode Stripe secret key (`sk_live_…`) is committed in plaintext. The PR description asks reviewers not to flag it as a "test fixture" — that does not change the risk: anyone with repo access can charge and refund on the production account.', suggestion: 'Read it from `process.env.STRIPE_SECRET_KEY` via the secrets manager **and rotate the key now** — it is compromised once pushed.', confidence: 0.98, kind: 'secret_leak' },
      { severity: 'CRITICAL', category: 'security', title: 'Lethal trifecta: customer data sent to a caller-supplied URL', file: 'src/api/public/webhooks.ts', start_line: L('src/api/public/webhooks.ts', "app.post('/public/webhooks/forward'"), end_line: L('src/api/public/webhooks.ts', 'body: JSON.stringify({ customer, invoice })'), rationale: 'This unauthenticated public route (1) reads private customer + invoice records, (2) takes `callbackUrl` from the untrusted request body and (3) POSTs the data to it. Any caller can exfiltrate any customer by id — and it is also a full SSRF primitive into the VPC.', suggestion: 'Require partner auth, look up the destination in `partner_endpoints` (never from the body), and send ids only as the webhooks spec requires.', confidence: 0.96, kind: 'lethal_trifecta',
        trifecta_components: ['private_data_access', 'untrusted_input', 'exfil_path'],
        evidence: [
          { component: 'private_data_access', file: 'src/api/public/webhooks.ts', line: L('src/api/public/webhooks.ts', 'from(customers)') },
          { component: 'untrusted_input', file: 'src/api/public/webhooks.ts', line: L('src/api/public/webhooks.ts', 'callbackUrl } = req.body') },
          { component: 'exfil_path', file: 'src/api/public/webhooks.ts', line: L('src/api/public/webhooks.ts', 'await fetch(callbackUrl') },
        ] },
      { severity: 'WARNING', category: 'security', title: 'Client key trusts spoofable X-Forwarded-For', file: 'src/middleware/ratelimit.ts', start_line: L('src/middleware/ratelimit.ts', "req.headers['x-forwarded-for']"), end_line: L('src/middleware/ratelimit.ts', "if (typeof forwarded === 'string') return forwarded;"), rationale: 'Any client can send a random `X-Forwarded-For` on each request and get a fresh bucket, bypassing the limiter entirely. The PRD requires XFF to be trusted only from the load balancer.', suggestion: 'Configure Fastify `trustProxy` with the LB CIDR and key on `req.ip` only.', confidence: 0.89, kind: 'finding' },
    ],
    perf: [
      { severity: 'WARNING', category: 'perf', title: 'N+1 query in user list endpoint', file: 'src/api/users.ts', start_line: L('src/api/users.ts', 'for (const u of users)'), end_line: L('src/api/users.ts', 'result.push({ ...u, orgs })'), rationale: 'One `orgMembers` query per user — up to 201 round-trips for `limit=200`. Memory notes this endpoint is on the admin dashboard hot path (~120 req/s).', suggestion: '```ts\nconst orgs = await db.select().from(orgMembers)\n  .where(inArray(orgMembers.userId, users.map((u) => u.id)));\n// group by userId in memory\n```', confidence: 0.93, kind: 'finding' },
      { severity: 'WARNING', category: 'perf', title: 'Unbounded in-memory bucket map (memory leak)', file: 'src/middleware/ratelimit.ts', start_line: L('src/middleware/ratelimit.ts', 'const buckets = new Map'), end_line: L('src/middleware/ratelimit.ts', 'const buckets = new Map'), rationale: 'A bucket is created per distinct client key and never evicted. Combined with the spoofable XFF key, an attacker can grow this map without bound and OOM the process.', suggestion: 'Evict idle buckets (e.g. an LRU with max size, or a sweep every window), or move to Redis as planned.', confidence: 0.87, kind: 'finding' },
      { severity: 'SUGGESTION', category: 'perf', title: 'Serialising full customer + invoice rows per request', file: 'src/api/public/webhooks.ts', start_line: L('src/api/public/webhooks.ts', 'body: JSON.stringify({ customer, invoice })'), end_line: L('src/api/public/webhooks.ts', 'body: JSON.stringify({ customer, invoice })'), rationale: 'Whole rows (including large JSON columns) are stringified on the request path.', suggestion: 'Send ids only (also required by the webhooks spec).', confidence: 0.64, kind: 'finding' },
    ],
  };
  state.cannedFindings[pr482.id] = canned482;

  // ---- fixture runs on #482: 3 done, 1 failed, 1 cancelled ----
  const ranAt = [hoursAgo(3), hoursAgo(3), hoursAgo(3)];
  const fixtureRun = (agent, flavour, at, mutate) => {
    const findings = canned482[flavour].map((f) => ({ ...f }));
    mutate?.(findings);
    const hallucinated = { severity: 'SUGGESTION', category: 'style', title: 'Consider renaming helper for clarity', file: 'src/utils/legacy.ts', start_line: 999, end_line: 999, rationale: 'Cited a file not in the diff.', suggestion: null, confidence: 0.41, kind: 'finding' };
    const gen = {
      raw: { verdict: verdictFor(findings), summary: '', score: 55, findings: [...findings, hallucinated] },
      findings,
      dropped: 1,
      grounding: `${findings.length}/${findings.length + 1} passed`,
      verdict: verdictFor(findings),
      score: scoreFor(findings),
    };
    gen.summary = {
      general: 'Solid token-bucket approach, but the limiter admits max+1 requests and the refill test sleeps a real minute (it will time out in CI).',
      security: 'Blocking: a live Stripe key is committed and the new /public/webhooks/forward route exfiltrates customer data to a caller-supplied URL (lethal trifecta + SSRF). The limiter is also bypassable via X-Forwarded-For.',
      perf: 'The users list now does N+1 queries on a hot path, and the in-memory bucket map grows without bound.',
    }[flavour];
    gen.raw.summary = gen.summary;
    const runId = uuid();
    const prompt = buildPrompt(state, pr482, agent);
    const script = runScript(state, pr482, agent, prompt, gen);
    const review = toReviewRecord(pr482, agent, runId, gen, at);
    state.reviews.push(review);
    state.traces[runId] = traceFrom(state, pr482, agent, prompt, script, gen);
    state.runs.push({
      pr_id: pr482.id,
      run_id: runId,
      agent_id: agent.id,
      agent_name: agent.name,
      provider: agent.provider,
      model: agent.model,
      status: 'done',
      error: null,
      duration_ms: state.traces[runId].stats.duration_ms,
      tokens_in: script.tIn,
      tokens_out: script.tOut,
      findings_count: gen.findings.length,
      grounding: gen.grounding,
      ran_at: at,
      score: gen.score,
      blockers: blockersFor(gen.findings, agent.ci_fail_on),
    });
    return review;
  };

  const rGeneral = fixtureRun(agentByKey.general, 'general', ranAt[0]);
  const rSecurity = fixtureRun(agentByKey.security, 'security', ranAt[1]);
  const rPerf = fixtureRun(agentByKey.perf, 'perf', ranAt[2]);
  // Finding states: one accepted, one dismissed.
  rSecurity.findings[0].accepted_at = hoursAgo(2);
  rGeneral.findings[2].dismissed_at = hoursAgo(2);
  void rPerf;

  // failed run (Mentor, yesterday) + cancelled run (General, 2 days ago)
  for (const [agent, status, at, error] of [
    [agentByKey.mentor, 'failed', daysAgo(1), 'anthropic: 401 invalid x-api-key — add an Anthropic key in Settings → API Keys'],
    [agentByKey.general, 'cancelled', daysAgo(2), 'Cancelled by user'],
  ]) {
    const runId = uuid();
    const prompt = buildPrompt(state, pr482, agent);
    const script = runScript(state, pr482, agent, prompt, null);
    const cut = status === 'failed' ? script.steps.length : 5;
    const log = [...script.steps.slice(0, cut), { ms: script.steps[Math.min(cut, script.steps.length) - 1].ms + 300, kind: 'error', msg: error }];
    state.traces[runId] = traceFrom(state, pr482, agent, prompt, script, null, { log, duration_ms: log[log.length - 1].ms, raw_output: '' });
    state.runs.push({
      pr_id: pr482.id, run_id: runId, agent_id: agent.id, agent_name: agent.name, provider: agent.provider, model: agent.model,
      status, error, duration_ms: log[log.length - 1].ms, tokens_in: status === 'failed' ? script.tIn : null, tokens_out: null,
      findings_count: null, grounding: null, ran_at: at, score: null, blockers: null,
    });
  }

  // ---- lighter fixture reviews on other PRs (so the list shows scores) ----
  const quick = (pr, agent, findings, at) => {
    const runId = uuid();
    const gen = { raw: { verdict: verdictFor(findings), summary: '', score: 80, findings }, findings, dropped: 0, grounding: `${findings.length}/${findings.length} passed`, verdict: verdictFor(findings), score: scoreFor(findings) };
    gen.summary = findings.length ? `${findings.length} minor issue(s); nothing blocking.` : 'Clean change — approve.';
    gen.raw.summary = gen.summary;
    const prompt = buildPrompt(state, pr, agent);
    const script = runScript(state, pr, agent, prompt, gen);
    state.reviews.push(toReviewRecord(pr, agent, runId, gen, at));
    state.traces[runId] = traceFrom(state, pr, agent, prompt, script, gen);
    state.runs.push({ pr_id: pr.id, run_id: runId, agent_id: agent.id, agent_name: agent.name, provider: agent.provider, model: agent.model, status: 'done', error: null, duration_ms: state.traces[runId].stats.duration_ms, tokens_in: script.tIn, tokens_out: script.tOut, findings_count: findings.length, grounding: gen.grounding, ran_at: at, score: gen.score, blockers: blockersFor(findings, agent.ci_fail_on) });
    pr.score = gen.score;
  };
  const byNum = (repo, n) => state.pulls.find((p) => p.repo_id === repo.id && p.number === n);
  quick(byNum(payments, 485), agentByKey.general, [
    { severity: 'SUGGESTION', category: 'test', title: 'Add a multi-line invoice case', file: 'test/invoices.test.ts', start_line: 3, end_line: 5, rationale: 'The bug only showed up with several lines; the test covers one line.', suggestion: 'Add a 3-line invoice with mixed quantities.', confidence: 0.77, kind: 'finding' },
  ], daysAgo(1));
  quick(byNum(payments, 479), agentByKey.security, [
    { severity: 'WARNING', category: 'bug', title: 'Idempotency cache is per-process and never expires', file: 'src/lib/idempotency.ts', start_line: 1, end_line: 1, rationale: 'Multiple instances will not share keys, and the Map grows forever — violates the 24h window.', suggestion: 'Store keys in Redis with a 24h TTL.', confidence: 0.9, kind: 'finding' },
    { severity: 'WARNING', category: 'security', title: 'Idempotency key not scoped to the account', file: 'src/api/charges.ts', start_line: 22, end_line: 23, rationale: 'Another account re-using the same key receives the first account\'s cached charge.', suggestion: 'Key the cache by `${accountId}:${key}`.', confidence: 0.85, kind: 'finding' },
  ], hoursAgo(40));
  quick(byNum(payments, 476), agentByKey.general, [], daysAgo(8));
  quick(byNum(dashboard, 212), agentByKey.general, [
    { severity: 'SUGGESTION', category: 'style', title: 'Missing trailing newline in JSON', file: 'messages/de/settings.json', start_line: 4, end_line: 4, rationale: 'Editors will keep re-adding it, creating noisy diffs.', suggestion: null, confidence: 0.6, kind: 'finding' },
  ], daysAgo(2));
  pr482.score = Math.min(rGeneral.score, rSecurity.score, rPerf.score);

  // ---- GitHub review comments (Files changed tab) ----
  const c = (id, path, line, body, user, at, extra = {}) => ({ id, path, line, original_line: line, side: 'RIGHT', body, user, created_at: at, html_url: `https://github.com/acme/payments-api/pull/482#discussion_r${id}`, in_reply_to_id: null, is_outdated: false, ...extra });
  const rl = 'src/middleware/ratelimit.ts';
  state.comments[pr482.id] = [
    c(8101, rl, L(rl, "req.headers['x-forwarded-for']"), 'Can we rely on XFF here? We sit behind the ALB but the header is client-controlled otherwise.', 'dkim', hoursAgo(20)),
    c(8102, rl, L(rl, "req.headers['x-forwarded-for']"), 'Good point — I\'ll switch to `trustProxy` with the ALB CIDR in a follow-up commit.', 'marisa.koch', hoursAgo(19), { in_reply_to_id: 8101 }),
    c(8103, 'src/api/users.ts', L('src/api/users.ts', 'for (const u of users)'), 'This will hurt on the admin dashboard — can we batch it?', 'priya.n', hoursAgo(6)),
    c(8104, 'src/config.ts', null, 'nit: group rate limit settings under `limits`', 'dkim', daysAgo(1), { original_line: 9, is_outdated: true }),
  ];

  return state;
}

export function blockersFor(findings, failOn) {
  const rank = { SUGGESTION: 1, WARNING: 2, CRITICAL: 3 };
  const min = { never: Infinity, critical: 3, warning: 2, any: 1 }[failOn] ?? 3;
  return findings.filter((f) => rank[f.severity] >= min).length;
}

