# DevDigest mock API

In-memory Express server that stands in for the real DevDigest Fastify API
so the web client can be demoed and developed **without Docker, Postgres, LLM
keys or GitHub**. Every screen has data; nothing is hidden by missing data.

```bash
npm install && npm run dev        # from the repo root: API :3001 + UI :3000
npm --prefix mock-server start    # API only
```

Port **3001** must be free.

## What it simulates

| Area | Behaviour |
|---|---|
| Repos | 3 repos: `acme/payments-api` (fully indexed), `acme/web-dashboard` (partial index), `acme/mobile-sdk` (not cloned, degraded). Adding any GitHub URL creates a repo with 2 PRs. |
| Pull requests | 13 PRs in every state (needs review / reviewed / stale / merged / closed) with real unified-diff patches, commits, linked issue and GitHub-style inline comments (incl. a reply thread and an outdated comment). |
| Reviews | Flagship PR **#482**: 3 finished agent runs (general / security / performance) with CRITICAL secret leak, a **lethal trifecta** finding with evidence, warnings and suggestions, one accepted and one dismissed finding, plus a failed and a cancelled run. |
| Run a review | `POST /pulls/:id/review` really runs: live SSE log (~6s), then a grounded review is saved (one hallucinated finding is dropped by the grounding gate), a full run trace is written and the PR becomes *reviewed*. Cancel works. |
| Prompt | Traces and `GET /agents/:id/prompt-preview` build the prompt exactly like `reviewer-core` `assemblePrompt`: system prompt + injection guard, task, PR description, **skills**, **memory**, repo skeleton, **project context specs**, callers, diff. |
| Agents | 5 agents (3 enabled) with version history, linked skills, per-provider model lists with prices. |
| Skills | 7 skills (rubric / security / convention / custom; manual / extracted / community / URL), versions, "needs vetting" for untrusted sources, community catalog, import from text / URL / catalog. |
| Conventions | Extracted candidates with evidence; *Accept as Skill* creates a `convention` skill; *Re-scan* adds candidates. |
| Memory | 12 entries across scopes/kinds, incl. stale ones; *Learn* on a finding adds an entry. |
| Project context | Spec files (with mermaid diagrams), edit/create, re-index, repo-intel resync. |
| Settings | Key status (Anthropic deliberately "Not set"), connection tests, per-feature models. |

State lives in memory: restart the server — or `POST http://localhost:3001/__reset` —
to get the demo data back. `MOCK_LATENCY_MS` (default 150) adds latency so
loading states are visible.

## Layout

```
src/server.js          routes (same paths/shapes as the real API)
src/data/seed.js       builds the whole demo state
src/data/pr482.js      flagship PR diff (findings are anchored to these lines)
src/data/knowledge.js  skills, community catalog, conventions, memory, specs
src/data/agent-prompts.js  built-in reviewer prompts (copied from upstream server/src/db/seed-prompts.ts)
src/lib/prompt.js      JS mirror of reviewer-core assemblePrompt + taskLine
src/lib/engine.js      fake reviewer: prompt building, run log, traces, findings
```

Routes the real server does not have yet (the prototype's extensions):
`/skills*`, `/repos/:id/conventions*`, `/conventions/:id/*`, `/memory*`,
`/repos/:id/context*` (write/status), `/agents/:id/prompt-preview`, `/__reset`.
