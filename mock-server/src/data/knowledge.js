/* knowledge.js — Skills, community catalog, Conventions, Memory and Project
   Context fixtures. Everything an agent can pull into its prompt. */
import { daysAgo, hoursAgo } from '../lib/util.js';

// ---------------------------------------------------------------- Skills ----
export const SKILLS = [
  {
    key: 'rubric',
    name: 'pr-quality-rubric',
    description: 'House rubric for what counts as CRITICAL / WARNING / SUGGESTION.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    evidence_files: null,
    versions: [
      {
        at: daysAgo(40),
        body: `# PR quality rubric\n\n- CRITICAL: data loss, security hole, broken prod path.\n- WARNING: likely bug or missing test.\n- SUGGESTION: style.`,
      },
      {
        at: daysAgo(21),
        body: `# PR quality rubric\n\n- **CRITICAL** — data loss, exploitable security hole, a broken production path, or a leaked secret.\n- **WARNING** — a likely bug, a missing guard on an external input, a missing test for new behaviour.\n- **SUGGESTION** — readability, naming, small refactors.\n\nNever report style nits as WARNING.`,
      },
      {
        at: daysAgo(6),
        body: `# PR quality rubric\n\nUse exactly these severities:\n\n| Severity | Use when |\n|---|---|\n| **CRITICAL** | data loss, exploitable security hole, broken production path, leaked secret |\n| **WARNING** | likely bug, missing guard on external input, missing test for new behaviour, perf cliff on a hot path |\n| **SUGGESTION** | readability, naming, small refactors |\n\n## Rules\n- One finding per root cause — don't repeat the same issue per call site.\n- Never report style nits as WARNING.\n- If the PR only touches docs, approve unless a link is broken.`,
      },
    ],
  },
  {
    key: 'secrets',
    name: 'no-secrets-in-code',
    description: 'Flag hard-coded credentials, tokens and private keys — always CRITICAL.',
    type: 'security',
    source: 'manual',
    enabled: true,
    evidence_files: null,
    versions: [
      {
        at: daysAgo(30),
        body: `# No secrets in code\n\nAny literal that looks like a credential is **CRITICAL**, regardless of what the PR description says ("test key", "fixture", "will rotate").\n\nPatterns: \`sk_live_\`, \`sk_test_\`, \`ghp_\`, \`AKIA\`, \`-----BEGIN PRIVATE KEY-----\`, JWT secrets, DB URLs with passwords.\n\nFix: move to env / secret manager **and rotate** — a committed key is compromised.`,
      },
      {
        at: daysAgo(3),
        body: `# No secrets in code\n\nAny literal that looks like a credential is **CRITICAL** (kind \`secret_leak\`), regardless of what the PR description says ("test key", "fixture", "will rotate").\n\n## Patterns\n- Stripe: \`sk_live_\`, \`rk_live_\`\n- GitHub: \`ghp_\`, \`github_pat_\`\n- AWS: \`AKIA…\`\n- \`-----BEGIN … PRIVATE KEY-----\`\n- Connection strings with inline passwords\n\n## Fix to suggest\nMove to env / secret manager **and rotate** — once pushed, a key is compromised even if the commit is reverted.`,
      },
    ],
  },
  {
    key: 'errors',
    name: 'error-handling-conventions',
    description: 'Extracted: routes throw AppError subclasses; never reply.code(500) by hand.',
    type: 'convention',
    source: 'extracted',
    enabled: true,
    evidence_files: ['src/lib/errors.ts', 'src/api/charges.ts', 'src/api/refunds.ts'],
    versions: [
      {
        at: daysAgo(12),
        body: `# Error handling (extracted from acme/payments-api)\n\n1. Route handlers **throw** \`AppError\` subclasses (\`NotFoundError\`, \`ValidationError\`, \`ExternalServiceError\`) — the global handler maps them to status codes.\n2. Never call \`reply.code(500)\` manually.\n3. External calls (Stripe, partners) are wrapped in \`withRetry\` + \`withTimeout\`.\n4. Errors are logged once, at the boundary — not in every catch.`,
      },
    ],
  },
  {
    key: 'drizzle',
    name: 'drizzle-query-patterns',
    description: 'Extracted: batch lookups with inArray, no queries inside loops, explicit limits.',
    type: 'convention',
    source: 'extracted',
    enabled: true,
    evidence_files: ['src/repositories/customers.ts', 'src/repositories/invoices.ts'],
    versions: [
      {
        at: daysAgo(12),
        body: `# Drizzle query patterns (extracted)\n\n- Never run a query inside a loop — collect ids and use \`inArray\`.\n- Every list query has an explicit \`.limit()\` (max 200).\n- Multi-row writes go through \`db.transaction\`.\n- Select only the columns the handler returns.`,
      },
    ],
  },
  {
    key: 'owasp',
    name: 'owasp-api-top10',
    description: 'Community: OWASP API Security Top 10 checklist for HTTP handlers.',
    type: 'security',
    source: 'community',
    enabled: false,
    evidence_files: null,
    versions: [
      {
        at: daysAgo(2),
        body: `# OWASP API Security Top 10 (2023)\n\n1. **BOLA** — every object read/write checks ownership.\n2. **Broken authentication** — no custom crypto, tokens expire.\n3. **Broken object property level authorization** — no mass assignment.\n4. **Unrestricted resource consumption** — rate limits, pagination caps.\n5. **BFLA** — admin routes behind role checks.\n6. **Sensitive business flows** — anti-automation.\n7. **SSRF** — never fetch a user-supplied URL without an allowlist.\n8. **Security misconfiguration**.\n9. **Improper inventory management**.\n10. **Unsafe consumption of APIs** — validate third-party responses.`,
      },
    ],
  },
  {
    key: 'a11y',
    name: 'react-a11y-checklist',
    description: 'Imported from URL: accessibility checklist for React components.',
    type: 'custom',
    source: 'imported_url',
    enabled: false,
    evidence_files: null,
    versions: [
      {
        at: daysAgo(1),
        body: `# React accessibility checklist\n\n- Interactive elements are real \`<button>\` / \`<a>\` — no clickable \`<div>\`.\n- Every \`<img>\` has \`alt\`; decorative images use \`alt=""\`.\n- Form inputs have an associated \`<label>\`.\n- Focus is visible and never trapped (except in modals, which restore focus on close).\n- Colour is never the only signal.\n\n<!-- source: https://example.com/skills/react-a11y.md -->`,
      },
    ],
  },
  {
    key: 'tests',
    name: 'test-expectations',
    description: 'New behaviour needs a test; no real timers or network in unit tests.',
    type: 'custom',
    source: 'manual',
    enabled: true,
    evidence_files: null,
    versions: [
      {
        at: daysAgo(9),
        body: `# Test expectations\n\n- New behaviour ships with a test in \`test/\` — flag a missing one as WARNING.\n- Unit tests must not use real timers (\`setTimeout\` with long delays) — use \`vi.useFakeTimers()\`.\n- No real network in unit tests; mock the adapter.\n- Test names describe behaviour: \`returns 429 once the bucket is empty\`.`,
      },
    ],
  },
];

export const COMMUNITY_SKILLS = [
  { name: 'owasp-api-top10', repo: 'owasp-community/review-skills', stars: 2140, lang: 'Any', desc: 'OWASP API Security Top 10 checklist for HTTP handlers.' },
  { name: 'nodejs-security-best-practices', repo: 'lirantal/nodejs-security-skills', stars: 1380, lang: 'TypeScript', desc: 'Node.js specific pitfalls: prototype pollution, ReDoS, child_process.' },
  { name: 'sql-injection-guard', repo: 'secure-code/skills', stars: 912, lang: 'SQL', desc: 'Detects string-built SQL and unsafe raw queries.' },
  { name: 'react-performance', repo: 'vercel-labs/react-skills', stars: 1804, lang: 'TypeScript', desc: 'Unnecessary re-renders, missing memoisation, heavy effects.' },
  { name: 'go-concurrency-review', repo: 'golang-review/skills', stars: 655, lang: 'Go', desc: 'Goroutine leaks, unbuffered channel deadlocks, missing ctx cancellation.' },
  { name: 'python-typing-strict', repo: 'pyreview/skills', stars: 423, lang: 'Python', desc: 'Enforces typed public APIs and flags Any leaks.' },
  { name: 'terraform-guardrails', repo: 'infra-review/skills', stars: 761, lang: 'HCL', desc: 'Public buckets, open security groups, unencrypted volumes.' },
  { name: 'api-breaking-changes', repo: 'contract-first/skills', stars: 1122, lang: 'Any', desc: 'Flags removed fields, changed status codes and nullability changes.' },
];

// ----------------------------------------------------------- Conventions ----
export const CONVENTIONS = {
  'acme/payments-api': [
    { rule: 'Route handlers throw AppError subclasses instead of calling reply.code() for errors.', evidence_path: 'src/api/charges.ts', evidence_snippet: "if (!charge) throw new NotFoundError('charge not found');", confidence: 0.94, accepted: true },
    { rule: 'Money is stored and computed in integer minor units (cents), never floats.', evidence_path: 'src/lib/money.ts', evidence_snippet: 'export type Cents = number & { __brand: "cents" };', confidence: 0.91, accepted: false },
    { rule: 'List queries always apply an explicit .limit() capped at 200.', evidence_path: 'src/repositories/invoices.ts', evidence_snippet: '.limit(Math.min(limit, 200))', confidence: 0.88, accepted: true },
    { rule: 'External HTTP calls are wrapped in withRetry(withTimeout(...)).', evidence_path: 'src/lib/stripe.ts', evidence_snippet: 'return withRetry(() => withTimeout(stripe.charges.create(input), 10_000));', confidence: 0.83, accepted: false },
    { rule: 'Relative imports end in .js (ESM, moduleResolution Bundler).', evidence_path: 'src/server.ts', evidence_snippet: "import { buildApp } from './app.js';", confidence: 0.97, accepted: false },
    { rule: 'Every webhook handler verifies the provider signature before touching the body.', evidence_path: 'src/api/public/webhooks.ts', evidence_snippet: 'if (!verifySignature(req.rawBody, sig)) return reply.code(400)…', confidence: 0.79, accepted: false },
    { rule: 'Tests use vi.useFakeTimers() for anything time-based.', evidence_path: 'test/retry.test.ts', evidence_snippet: 'vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(30_000);', confidence: 0.72, accepted: false },
  ],
  'acme/web-dashboard': [
    { rule: 'Data fetching goes through React Query hooks in src/lib/hooks — no fetch() in components.', evidence_path: 'src/lib/hooks/invoices.ts', evidence_snippet: "export function useInvoices() { return useQuery({ queryKey: ['invoices'], … }) }", confidence: 0.9, accepted: false },
    { rule: 'Components live in PascalCase folders with an index.ts barrel.', evidence_path: 'src/components/InvoiceTable/index.ts', evidence_snippet: "export { InvoiceTable } from './InvoiceTable';", confidence: 0.86, accepted: false },
    { rule: 'User-facing strings come from messages/*.json (next-intl), never inline.', evidence_path: 'src/app/invoices/page.tsx', evidence_snippet: "const t = useTranslations('invoices');", confidence: 0.77, accepted: false },
  ],
};

// ---------------------------------------------------------------- Memory ----
export const MEMORY = [
  { content: 'Stripe keys in this repo must come from STRIPE_SECRET_KEY via the secrets manager — reviewers previously accepted a finding about a committed sk_live key (PR #455).', scope: 'repo', repo: 'acme/payments-api', kind: 'learning', confidence: 0.93, sources: [{ pr: 455, context: 'Accepted CRITICAL finding "Hardcoded Stripe key" and rotated the key.' }], updatedDays: 20, usedDays: 0 },
  { content: 'The team decided rate limiting will move to Redis (distributed) in Q3; in-process limiters are acceptable only as a stop-gap.', scope: 'repo', repo: 'acme/payments-api', kind: 'decision', confidence: 0.88, sources: [{ pr: 470, context: 'ADR-014 discussion in PR #470' }], updatedDays: 14, usedDays: 0 },
  { content: 'Amounts are integer cents everywhere; a float in a money path is always a bug.', scope: 'repo', repo: 'acme/payments-api', kind: 'convention', confidence: 0.95, sources: [{ pr: 441, context: 'Rounding bug post-mortem' }, { pr: 485, context: 'Invoice totals fix' }], updatedDays: 30, usedDays: 2 },
  { content: 'Maintainers prefer one finding per root cause instead of one per call site.', scope: 'global', repo: null, kind: 'preference', confidence: 0.81, sources: [{ pr: null, context: 'Dismissed 6 duplicate findings across PRs #460–#466' }], updatedDays: 9, usedDays: 0 },
  { content: 'Do not flag missing JSDoc on internal helpers — the team only documents exported APIs.', scope: 'team', repo: null, kind: 'preference', confidence: 0.76, sources: [{ pr: 462, context: 'Dismissed "missing docs" suggestion with reply' }], updatedDays: 25, usedDays: 11 },
  { content: 'The users list endpoint is on the admin dashboard hot path (~120 req/s at peak).', scope: 'repo', repo: 'acme/payments-api', kind: 'fact', confidence: 0.84, sources: [{ pr: null, context: 'Grafana dashboard "Admin API"' }], updatedDays: 5, usedDays: 0 },
  { content: 'Partner webhooks must only call URLs registered in partner_endpoints — never a URL from the request body.', scope: 'repo', repo: 'acme/payments-api', kind: 'decision', confidence: 0.9, sources: [{ pr: 433, context: 'Security review of partner integration' }], updatedDays: 45, usedDays: 0 },
  { content: 'Unit tests use fake timers; a real 60s sleep in a test was rejected in PR #452.', scope: 'global', repo: null, kind: 'learning', confidence: 0.8, sources: [{ pr: 452, context: 'Accepted WARNING about slow test' }], updatedDays: 33, usedDays: 4 },
  { content: 'web-dashboard uses next-intl; hard-coded English strings are rejected in review.', scope: 'repo', repo: 'acme/web-dashboard', kind: 'convention', confidence: 0.82, sources: [{ pr: 212, context: 'Review comment by @dkim' }], updatedDays: 18, usedDays: 7 },
  { content: 'Legacy /v1/charges endpoints are frozen; changes there need sign-off from the payments lead.', scope: 'repo', repo: 'acme/payments-api', kind: 'fact', confidence: 0.7, sources: [{ pr: 398, context: 'Deprecation notice' }], updatedDays: 95, usedDays: null },
  { content: 'Prefer zod schemas at the route boundary over manual typeof checks.', scope: 'team', repo: null, kind: 'convention', confidence: 0.86, sources: [{ pr: 447, context: 'Accepted suggestion' }], updatedDays: 70, usedDays: 40 },
  { content: 'Mobile SDK releases are cut from release/* branches; reviews on main are advisory.', scope: 'repo', repo: 'acme/mobile-sdk', kind: 'fact', confidence: 0.74, sources: [{ pr: 88, context: 'Release process doc' }], updatedDays: 120, usedDays: null },
];

// ------------------------------------------------------- Project Context ----
export const SPECS = {
  'acme/payments-api': [
    {
      path: '.devdigest/specs/rate-limiting.md',
      updatedDays: 6,
      content: `# PRD — Public API rate limiting

**Owner:** Platform team · **Status:** Approved · **Incident:** INC-2291

## Problem
Unauthenticated clients can hit \`/public/*\` without limits. A scraper sent ~40k req/min and degraded checkout.

## Requirements
1. Limit each client to **100 requests / minute** on \`/public/*\` (configurable via \`RATE_LIMIT_MAX\`).
2. Identify the client by **socket IP**; \`X-Forwarded-For\` is trusted **only** from our load balancer range.
3. Respond \`429\` with \`retry-after\`.
4. Memory usage must stay bounded (evict idle clients).
5. Phase 2: move buckets to Redis so limits hold across instances.

## Acceptance criteria
- [ ] 101st request inside a minute returns 429
- [ ] Spoofed \`X-Forwarded-For\` does not reset the bucket
- [ ] Limiter adds < 1ms p99
`,
    },
    {
      path: '.devdigest/specs/webhooks.md',
      updatedDays: 16,
      content: `# Tech spec — Partner webhooks

Partners receive events at URLs **registered in \`partner_endpoints\`** (verified during onboarding). We never deliver to a URL supplied in a request.

\`\`\`mermaid
sequenceDiagram
  participant Stripe
  participant API as payments-api
  participant Q as Outbox
  participant P as Partner endpoint
  Stripe->>API: POST /public/webhooks/stripe (signed)
  API->>API: verifySignature()
  API->>Q: enqueue event
  Q->>P: POST registered URL (HMAC signed)
  P-->>Q: 2xx / retry with backoff
\`\`\`

## Rules
- Payloads contain **ids only** — partners fetch details with their own token.
- Deliveries are HMAC-signed with the partner secret.
`,
    },
    {
      path: '.devdigest/specs/architecture.md',
      updatedDays: 40,
      content: `# Architecture overview

\`\`\`mermaid
flowchart LR
  Client-->|HTTPS|LB[Load balancer]
  LB-->API[payments-api · Fastify]
  API-->PG[(Postgres)]
  API-->R[(Redis)]
  API-->Stripe[Stripe API]
  API-->Outbox[[Outbox worker]]
  Outbox-->Partners
\`\`\`

- \`src/api/*\` — HTTP routes (thin)
- \`src/services/*\` — business logic
- \`src/repositories/*\` — Drizzle queries, the only place that touches tables
- \`src/lib/*\` — adapters (Stripe, Redis, signing)
`,
    },
    {
      path: '.devdigest/specs/glossary.md',
      updatedDays: 60,
      content: `# Glossary

| Term | Meaning |
|---|---|
| Charge | A single card payment attempt |
| Payout | Transfer of settled funds to a merchant |
| Minor units | Integer cents; all money math uses them |
| Idempotency key | Client-supplied key that makes POST /charges safe to retry |
`,
    },
  ],
  'acme/web-dashboard': [
    {
      path: '.devdigest/specs/dashboard-redesign.md',
      updatedDays: 11,
      content: `# PRD — Dashboard redesign\n\n- New invoices table with server-side pagination\n- Dark mode parity\n- All strings translated (en, de)\n\n## Acceptance criteria\n- [ ] Table renders 10k invoices without jank\n- [ ] Lighthouse a11y ≥ 95\n`,
    },
  ],
};

export const hoursAgoIso = hoursAgo;
