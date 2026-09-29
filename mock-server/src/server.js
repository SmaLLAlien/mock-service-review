/* server.js — DevDigest mock API (Express, in-memory).

   Same routes and response shapes as the real Fastify server (see
   server/src/modules/* and server/src/vendor/shared/contracts), plus the
   Skills / Conventions / Memory / Project Context endpoints used by the
   prototype screens. No database, no LLM, no GitHub: state lives in memory and
   is rebuilt on restart or POST /__reset. Reviews are simulated and stream
   over SSE exactly like real runs. */
import express from 'express';
import cors from 'cors';
import { buildState, MODELS, blockersFor } from './data/seed.js';
import { buildPrompt, generateReview, runScript, toReviewRecord, traceFrom } from './lib/engine.js';
import { fakeSha, sleep, uuid, elapsed } from './lib/util.js';

const PORT = Number(process.env.API_PORT ?? 3001);
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 150);

let state = buildState();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
// Small artificial latency so skeletons / loading states are visible.
app.use((req, _res, next) => (req.path.endsWith('/events') ? next() : setTimeout(next, LATENCY_MS)));

// ------------------------------------------------------------- helpers ----
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const notFound = (what) => new HttpError(404, 'not_found', `${what} not found`);
const bad = (msg) => new HttpError(422, 'validation_error', msg);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((out) => {
  if (res.headersSent) return;
  if (out === undefined) res.status(204).end();
  else res.json(out);
}).catch(next);

const findRepo = (id) => state.repos.find((r) => r.id === id) ?? (() => { throw notFound('Repo'); })();
const findPull = (id) => state.pulls.find((p) => p.id === id) ?? (() => { throw notFound('Pull request'); })();
const findAgent = (id) => state.agents.find((a) => a.id === id) ?? (() => { throw notFound('Agent'); })();
const findSkill = (id) => state.skills.find((s) => s.id === id) ?? (() => { throw notFound('Skill'); })();

const prMeta = (p) => {
  const { body, files, commits, linked_issue, repo_id, ...meta } = p;
  return meta;
};
const prDetail = (p) => {
  const { repo_id, score, ...detail } = p;
  return detail;
};
const skillDto = (s) => s;

// ---------------------------------------------------------------- health ----
app.get('/health', (_req, res) => res.json({ ok: true, mock: true }));
app.get('/health/ready', (_req, res) => res.json({ ok: true, db: 'mock' }));
app.post('/__reset', wrap(() => {
  for (const run of Object.values(liveRuns)) run.cancelled = true;
  state = buildState();
  return { ok: true };
}));

// -------------------------------------------------------------- settings ----
app.get('/settings', wrap(() => state.settings));
app.put('/settings', wrap((req) => {
  state.settings = { ...state.settings, ...(req.body ?? {}) };
  return state.settings;
}));
app.get('/settings/secrets-status', wrap(() => state.secrets));
app.post('/settings/test-connection', wrap(async (req) => {
  const { provider, key } = req.body ?? {};
  if (!['openai', 'anthropic', 'openrouter', 'github'].includes(provider)) throw bad('unknown provider');
  await sleep(600);
  if (key) state.secrets[provider] = true;
  if (!state.secrets[provider]) {
    return { provider, ok: false, message: `No ${provider} key configured — paste one to test it.` };
  }
  const message = provider === 'github'
    ? 'Authenticated as @you (mock) · scopes: repo, read:org'
    : `Connected · ${(MODELS[provider] ?? []).length} models available (mock)`;
  return { provider, ok: true, message };
}));
app.get('/workspace', wrap(() => ({
  clone_dir: '~/.devdigest/workspace',
  repos: state.repos.map((r) => ({ full_name: r.full_name, clone_path: r.clone_path, size_mb: r.clone_path ? 18.4 : 0 })),
})));

// ----------------------------------------------------------------- repos ----
app.get('/repos', wrap(() => state.repos));
app.post('/repos', wrap(async (req, res) => {
  const url = String(req.body?.url ?? '');
  const m = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i) ?? url.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw bad('Expected a GitHub URL like https://github.com/owner/repo');
  const [, owner, name] = m;
  const existing = state.repos.find((r) => r.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase());
  if (existing) return existing;
  await sleep(900);
  const repo = {
    id: uuid(), workspace_id: state.workspace.id, owner, name, full_name: `${owner}/${name}`,
    default_branch: 'main', clone_path: `~/.devdigest/workspace/${owner}/${name}`,
    last_polled_at: new Date().toISOString(), created_by: state.workspace.user.id,
  };
  state.repos.push(repo);
  state.indexState[repo.id] = { status: 'full', filesIndexed: 128, filesSkipped: 0, lastIndexedSha: fakeSha(repo.full_name), updatedAt: new Date().toISOString() };
  state.conventions[repo.id] = [];
  state.context[repo.id] = [];
  state.contextStatus[repo.id] = { status: 'idle', pct: 0, message: 'No spec files yet', chunks_indexed: 0 };
  // two synthetic open PRs so the new repo isn't empty
  for (const [n, title, author] of [[12, 'Add health check endpoint', 'octocat'], [11, 'Fix typo in README', 'hubot']]) {
    const patch = `@@ -1,3 +1,5 @@\n import express from 'express';\n const app = express();\n+app.get('/health', (_req, res) => res.json({ ok: true }));\n+\n app.listen(3000);`;
    state.pulls.push({
      id: uuid(), repo_id: repo.id, number: n, title, author, branch: `feature/${n}`, base: 'main',
      head_sha: fakeSha(`${repo.full_name}#${n}`), additions: 2, deletions: 0, files_count: 1, status: 'needs_review',
      opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), score: null,
      body: `${title}.`, files: [{ path: 'src/index.ts', additions: 2, deletions: 0, patch }],
      commits: [{ sha: fakeSha(`${n}c`), message: title, author, committed_at: new Date().toISOString() }], linked_issue: null,
    });
  }
  res.status(201);
  return repo;
}));
app.post('/repos/:id/refresh', wrap(async (req) => {
  const repo = findRepo(req.params.id);
  await sleep(700);
  repo.last_polled_at = new Date().toISOString();
  return repo;
}));
app.post('/repos/:id/poll', wrap((req) => {
  const repo = findRepo(req.params.id);
  repo.last_polled_at = new Date().toISOString();
  return { repo_id: repo.id, synced: state.pulls.filter((p) => p.repo_id === repo.id).length };
}));
app.delete('/repos/:id', wrap((req) => {
  const repo = findRepo(req.params.id);
  state.repos = state.repos.filter((r) => r.id !== repo.id);
  state.pulls = state.pulls.filter((p) => p.repo_id !== repo.id);
  return { deleted: repo.id };
}));

// ------------------------------------------------------------ repo-intel ----
app.get('/repos/:id/index-state', wrap((req) => {
  findRepo(req.params.id);
  return state.indexState[req.params.id];
}));
app.post('/repos/:id/resync', wrap((req, res) => {
  const repo = findRepo(req.params.id);
  const st = state.indexState[repo.id];
  st.status = 'partial';
  setTimeout(() => {
    Object.assign(st, {
      status: 'full', filesIndexed: st.filesIndexed + st.filesSkipped || 96, filesSkipped: 0,
      lastIndexedSha: fakeSha(`${repo.id}:${Date.now()}`), updatedAt: new Date().toISOString(),
      degraded: false, degradedReason: undefined, reason: undefined,
    });
    if (!repo.clone_path) repo.clone_path = `~/.devdigest/workspace/${repo.full_name}`;
  }, 2500);
  res.status(202);
  return { status: 'accepted' };
}));

// ----------------------------------------------------------------- pulls ----
app.get('/repos/:id/pulls', wrap((req) => {
  findRepo(req.params.id);
  return state.pulls
    .filter((p) => p.repo_id === req.params.id)
    .sort((a, b) => b.number - a.number)
    .map(prMeta);
}));
app.get('/pulls/:id', wrap((req) => prDetail(findPull(req.params.id))));
app.get('/pulls/:id/comments', wrap((req) => {
  findPull(req.params.id);
  return state.comments[req.params.id] ?? [];
}));
app.post('/pulls/:id/comments', wrap((req, res) => {
  const pr = findPull(req.params.id);
  const { path, line, side = 'RIGHT', body, in_reply_to } = req.body ?? {};
  if (!path || !line || !body) throw bad('path, line and body are required');
  const repo = findRepo(pr.repo_id);
  const id = ++state.commentSeq;
  const comment = {
    id, path, line, original_line: line, side, body, user: 'you', created_at: new Date().toISOString(),
    html_url: `https://github.com/${repo.full_name}/pull/${pr.number}#discussion_r${id}`,
    in_reply_to_id: in_reply_to ?? null, is_outdated: false,
  };
  (state.comments[pr.id] ??= []).push(comment);
  res.status(201);
  return comment;
}));

// ---------------------------------------------------------------- agents ----
app.get('/agents', wrap(() => state.agents.map((a) => ({ ...a, skills: state.agentSkills[a.id] ?? [] }))));
app.get('/agents/:id', wrap((req) => {
  const a = findAgent(req.params.id);
  return { ...a, skills: state.agentSkills[a.id] ?? [] };
}));
app.post('/agents', wrap((req, res) => {
  const b = req.body ?? {};
  if (!b.name || !b.model || !b.system_prompt) throw bad('name, model and system_prompt are required');
  const agent = {
    id: uuid(), name: b.name, description: b.description ?? '', provider: b.provider ?? 'openrouter', model: b.model,
    system_prompt: b.system_prompt, output_schema: b.output_schema ?? null, enabled: b.enabled ?? true, version: 1,
    strategy: b.strategy ?? 'single-pass', ci_fail_on: 'critical', repo_intel: true,
  };
  state.agents.push(agent);
  state.agentSkills[agent.id] = [];
  state.agentVersions[agent.id] = [{ agent_id: agent.id, version: 1, created_at: new Date().toISOString(), config: versionConfig(agent) }];
  res.status(201);
  return { ...agent, skills: [] };
}));
const CONFIG_KEYS = ['provider', 'model', 'system_prompt', 'output_schema', 'strategy', 'ci_fail_on', 'repo_intel'];
function versionConfig(a) {
  return {
    provider: a.provider, model: a.model, system_prompt: a.system_prompt, output_schema: a.output_schema ?? null,
    strategy: a.strategy, ci_fail_on: a.ci_fail_on, repo_intel: a.repo_intel, skills: [...(state.agentSkills[a.id] ?? [])],
  };
}
function snapshotAgent(a) {
  a.version += 1;
  state.agentVersions[a.id].push({ agent_id: a.id, version: a.version, created_at: new Date().toISOString(), config: versionConfig(a) });
}
app.put('/agents/:id', wrap((req) => {
  const a = findAgent(req.params.id);
  const patch = req.body ?? {};
  const configChanged = CONFIG_KEYS.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(a[k]));
  for (const k of ['name', 'description', 'enabled', ...CONFIG_KEYS]) if (k in patch) a[k] = patch[k];
  if (configChanged) snapshotAgent(a);
  return { ...a, skills: state.agentSkills[a.id] ?? [] };
}));
app.delete('/agents/:id', wrap((req) => {
  const a = findAgent(req.params.id);
  state.agents = state.agents.filter((x) => x.id !== a.id);
  return { ok: true };
}));
app.get('/agents/:id/versions', wrap((req) => {
  findAgent(req.params.id);
  return [...state.agentVersions[req.params.id]].reverse();
}));
app.get('/agents/:id/versions/:version', wrap((req) => {
  findAgent(req.params.id);
  const v = state.agentVersions[req.params.id].find((x) => x.version === Number(req.params.version));
  if (!v) throw notFound('Agent version');
  return v;
}));
const skillLinks = (agentId) => (state.agentSkills[agentId] ?? []).map((skillId, order) => ({
  agent_id: agentId, skill_id: skillId, order, skill: state.skills.find((s) => s.id === skillId) ?? null,
}));
app.get('/agents/:id/skills', wrap((req) => {
  findAgent(req.params.id);
  return skillLinks(req.params.id);
}));
app.post('/agents/:id/skills', wrap((req) => {
  const a = findAgent(req.params.id);
  const { skill_ids, skill_id, order } = req.body ?? {};
  let ids = [...(state.agentSkills[a.id] ?? [])];
  if (Array.isArray(skill_ids)) ids = skill_ids.filter((id) => state.skills.some((s) => s.id === id));
  else if (skill_id) {
    findSkill(skill_id);
    ids = ids.filter((x) => x !== skill_id);
    ids.splice(order ?? ids.length, 0, skill_id);
  } else throw bad('skill_ids or skill_id required');
  const changed = JSON.stringify(ids) !== JSON.stringify(state.agentSkills[a.id]);
  state.agentSkills[a.id] = ids;
  if (changed) snapshotAgent(a);
  return skillLinks(a.id);
}));
app.get('/agents/:id/models', wrap((req) => MODELS[findAgent(req.params.id).provider] ?? []));
app.get('/providers/:id/models', wrap((req) => {
  if (!MODELS[req.params.id]) throw bad('unknown provider');
  return state.secrets[req.params.id] ? MODELS[req.params.id] : [];
}));
/** What the agent's prompt would look like on a PR (prototype helper). */
app.get('/agents/:id/prompt-preview', wrap((req) => {
  const a = findAgent(req.params.id);
  const pr = state.pulls.find((p) => p.id === req.query.prId) ?? state.pulls[0];
  const { assembly, skills, memory, specs } = buildPrompt(state, pr, a);
  return { pr: { id: pr.id, number: pr.number, title: pr.title }, assembly, skills: skills.map((s) => s.name), memory: memory.map((m) => m.content), specs: specs.map((s) => s.path) };
}));

// --------------------------------------------------------------- reviews ----
/** In-flight simulated runs: runId → { events, listeners, done, cancelled }. */
const liveRuns = {};

function publish(runId, ev) {
  const live = liveRuns[runId];
  if (!live) return;
  const event = { runId, seq: live.events.length + 1, t: elapsed(ev.ms), kind: ev.kind, msg: ev.msg };
  live.events.push(event);
  for (const l of live.listeners) l(event);
}
function finish(runId) {
  const live = liveRuns[runId];
  if (!live) return;
  live.done = true;
  for (const l of live.listeners) l(null);
  setTimeout(() => delete liveRuns[runId], 60_000);
}

async function executeRun(pr, agent, runId, index) {
  const live = liveRuns[runId];
  const run = state.runs.find((r) => r.run_id === runId);
  const prompt = buildPrompt(state, pr, agent);
  const gen = generateReview(state, pr, agent);
  const script = runScript(state, pr, agent, prompt, gen);
  // Compress the scripted timeline to ~5-7s of wall-clock (staggered per agent).
  const scale = 6000 / script.steps[script.steps.length - 1].ms;
  await sleep(index * 700);
  const started = Date.now();
  const emitted = [];
  for (const step of script.steps) {
    const wait = step.ms * scale - (Date.now() - started);
    if (wait > 0) await sleep(wait);
    if (live.cancelled) {
      const ms = step.ms;
      emitted.push({ ms, kind: 'error', msg: 'Run cancelled by user' });
      publish(runId, { ms, kind: 'error', msg: 'Run cancelled by user' });
      Object.assign(run, { status: 'cancelled', error: 'Cancelled by user', duration_ms: Date.now() - started });
      state.traces[runId] = traceFrom(state, pr, agent, prompt, script, null, { log: emitted, duration_ms: ms });
      return finish(runId);
    }
    emitted.push(step);
    publish(runId, step);
  }
  const at = new Date().toISOString();
  const review = toReviewRecord(pr, agent, runId, gen, at);
  state.reviews.push(review);
  state.traces[runId] = traceFrom(state, pr, agent, prompt, script, gen);
  Object.assign(run, {
    status: 'done', duration_ms: state.traces[runId].stats.duration_ms, tokens_in: script.tIn, tokens_out: script.tOut,
    findings_count: gen.findings.length, grounding: gen.grounding, score: gen.score, blockers: blockersFor(gen.findings, agent.ci_fail_on),
  });
  pr.score = Math.min(...state.reviews.filter((r) => r.pr_id === pr.id && r.score != null).map((r) => r.score));
  if (['needs_review', 'stale', 'open'].includes(pr.status)) pr.status = 'reviewed';
  finish(runId);
}

app.post('/pulls/:id/review', wrap((req) => {
  const pr = findPull(req.params.id);
  const { agentId, all } = req.body ?? {};
  const agents = all ? state.agents.filter((a) => a.enabled) : agentId ? [findAgent(agentId)] : [];
  if (agents.length === 0) throw bad(all ? 'No enabled agents — enable one on the Agents page.' : 'agentId or all:true is required');
  const runs = agents.map((agent, i) => {
    const runId = uuid();
    state.runs.push({
      pr_id: pr.id, run_id: runId, agent_id: agent.id, agent_name: agent.name, provider: agent.provider, model: agent.model,
      status: 'running', error: null, duration_ms: null, tokens_in: null, tokens_out: null, findings_count: null,
      grounding: null, ran_at: new Date().toISOString(), score: null, blockers: null,
    });
    liveRuns[runId] = { events: [], listeners: new Set(), done: false, cancelled: false };
    executeRun(pr, agent, runId, i).catch((err) => {
      console.error(err);
      publish(runId, { ms: 0, kind: 'error', msg: String(err?.message ?? err) });
      const run = state.runs.find((r) => r.run_id === runId);
      Object.assign(run, { status: 'failed', error: String(err?.message ?? err) });
      finish(runId);
    });
    return { run_id: runId, agent_id: agent.id, agent_name: agent.name };
  });
  return { pr_id: pr.id, runs, reviews: [] };
}));

app.get('/runs/:id/events', (req, res) => {
  const runId = req.params.id;
  res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.flushHeaders();
  const send = (e) => {
    if (e === null) return res.end();
    res.write(`id: ${e.seq}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
  };
  const live = liveRuns[runId];
  if (!live) {
    // Finished run: replay its stored log once, then close.
    const trace = state.traces[runId];
    (trace?.log ?? []).forEach((l, i) => send({ runId, seq: i + 1, t: l.t, kind: l.kind, msg: l.msg }));
    return res.end();
  }
  live.events.forEach(send);
  if (live.done) return res.end();
  live.listeners.add(send);
  req.on('close', () => live.listeners.delete(send));
});
app.get('/pulls/:id/runs/active', wrap((req) => state.runs
  .filter((r) => r.pr_id === req.params.id && r.status === 'running')
  .map((r) => ({ run_id: r.run_id, agent_id: r.agent_id, agent_name: r.agent_name, ran_at: r.ran_at }))));
app.get('/pulls/:id/runs', wrap((req) => state.runs
  .filter((r) => r.pr_id === req.params.id)
  .sort((a, b) => (b.ran_at ?? '').localeCompare(a.ran_at ?? ''))
  .map(({ pr_id, ...r }) => r)));
app.delete('/runs/:id', wrap((req) => {
  const before = state.runs.length;
  state.runs = state.runs.filter((r) => r.run_id !== req.params.id);
  state.reviews = state.reviews.filter((r) => r.run_id !== req.params.id);
  delete state.traces[req.params.id];
  return { ok: state.runs.length < before };
}));
app.post('/runs/:id/cancel', wrap((req) => {
  if (liveRuns[req.params.id]) liveRuns[req.params.id].cancelled = true;
  return { ok: true };
}));
app.get('/runs/:id/trace', wrap((req) => {
  const t = state.traces[req.params.id];
  if (!t) throw notFound('Run trace');
  return t;
}));
app.get('/pulls/:id/reviews', wrap((req) => state.reviews
  .filter((r) => r.pr_id === req.params.id)
  .sort((a, b) => b.created_at.localeCompare(a.created_at))));
app.delete('/reviews/:id', wrap((req) => {
  state.reviews = state.reviews.filter((r) => r.id !== req.params.id);
  return { ok: true };
}));
for (const action of ['accept', 'dismiss', 'learn', 'reply']) {
  app.post(`/findings/:id/${action}`, wrap((req) => {
    const review = state.reviews.find((r) => r.findings.some((f) => f.id === req.params.id));
    if (!review) throw notFound('Finding');
    const f = review.findings.find((x) => x.id === req.params.id);
    const now = new Date().toISOString();
    if (action === 'accept') Object.assign(f, { accepted_at: now, dismissed_at: null });
    if (action === 'dismiss') Object.assign(f, { dismissed_at: now, accepted_at: null });
    let memoryId;
    if (action === 'learn' || (action === 'dismiss' && req.body?.reply)) {
      const pr = state.pulls.find((p) => p.id === review.pr_id);
      const repo = state.repos.find((r) => r.id === pr?.repo_id);
      const item = {
        id: uuid(),
        content: action === 'learn'
          ? `${f.title} — ${f.suggestion ?? f.rationale}`.slice(0, 400)
          : `Reviewers dismissed "${f.title}": ${req.body.reply}`,
        scope: 'repo', kind: action === 'learn' ? 'learning' : 'preference', confidence: 0.8,
        sources: [{ pr: pr?.number ?? null, context: `${action} on finding in ${f.file}:${f.start_line}` }],
        repo: repo?.full_name ?? null, created_at: now, updated_at: now, last_used_at: null,
      };
      state.memory.unshift(item);
      memoryId = item.id;
    }
    return { finding: f, ...(memoryId ? { memoryId } : {}) };
  }));
}

// ---------------------------------------------------------------- skills ----
app.get('/skills', wrap((req) => {
  const q = String(req.query.q ?? '').toLowerCase();
  return state.skills
    .filter((s) => !q || `${s.name} ${s.description}`.toLowerCase().includes(q))
    .map((s) => ({ ...skillDto(s), agents: state.agents.filter((a) => (state.agentSkills[a.id] ?? []).includes(s.id)).map((a) => ({ id: a.id, name: a.name })) }));
}));
app.get('/skills/community', wrap((req) => {
  const q = String(req.query.q ?? '').toLowerCase();
  const lang = String(req.query.lang ?? '');
  return state.communitySkills.filter((c) => (!q || `${c.name} ${c.desc}`.toLowerCase().includes(q)) && (!lang || c.lang === lang));
}));
app.get('/skills/:id', wrap((req) => {
  const s = findSkill(req.params.id);
  return { ...s, agents: state.agents.filter((a) => (state.agentSkills[a.id] ?? []).includes(s.id)).map((a) => ({ id: a.id, name: a.name })) };
}));
app.get('/skills/:id/versions', wrap((req) => {
  findSkill(req.params.id);
  return [...state.skillVersions[req.params.id]].reverse();
}));
function createSkill({ name, description, type = 'custom', source, body, enabled, evidence_files = null }) {
  const now = new Date().toISOString();
  const skill = { id: uuid(), name, description, type, source, body, enabled, version: 1, evidence_files, created_at: now, updated_at: now };
  state.skills.unshift(skill);
  state.skillVersions[skill.id] = [{ skill_id: skill.id, version: 1, body, created_at: now }];
  return skill;
}
app.post('/skills', wrap((req, res) => {
  const { name, body, type, description } = req.body ?? {};
  if (!body?.trim()) throw bad('Skill body is required');
  const derived = name?.trim() || body.match(/^#\s+(.+)$/m)?.[1]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'untitled-skill';
  res.status(201);
  return createSkill({ name: derived, description: description ?? body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 120) ?? '', type: type ?? 'custom', source: 'manual', body, enabled: true });
}));
app.post('/skills/import-url', wrap(async (req, res) => {
  const url = String(req.body?.url ?? '');
  if (!/^https?:\/\//.test(url)) throw bad('A http(s) URL is required');
  await sleep(1000);
  const name = url.split('/').pop()?.replace(/\.md$/i, '') || 'imported-skill';
  res.status(201);
  return createSkill({ name, description: `Imported from ${new URL(url).host}`, type: 'custom', source: 'imported_url', body: `# ${name}\n\n(mock) Content fetched from ${url}.\n\n- Rule 1: …\n- Rule 2: …\n\n<!-- source: ${url} -->`, enabled: false });
}));
app.post('/skills/community/import', wrap(async (req, res) => {
  const c = state.communitySkills.find((x) => x.name === req.body?.name);
  if (!c) throw notFound('Community skill');
  await sleep(700);
  res.status(201);
  return createSkill({ name: c.name, description: c.desc, type: /secur|owasp|sql|guard/i.test(c.name) ? 'security' : 'custom', source: 'community', body: `# ${c.name}\n\n> From ${c.repo} (★ ${c.stars})\n\n${c.desc}\n\n## Checks\n- …`, enabled: false });
}));
app.put('/skills/:id', wrap((req) => {
  const s = findSkill(req.params.id);
  const { body, enabled, name, description, type } = req.body ?? {};
  if (typeof enabled === 'boolean') s.enabled = enabled;
  if (name) s.name = name;
  if (description !== undefined) s.description = description;
  if (type) s.type = type;
  if (typeof body === 'string' && body !== s.body) {
    s.body = body;
    s.version += 1;
    state.skillVersions[s.id].push({ skill_id: s.id, version: s.version, body, created_at: new Date().toISOString() });
  }
  s.updated_at = new Date().toISOString();
  return s;
}));
app.delete('/skills/:id', wrap((req) => {
  findSkill(req.params.id);
  state.skills = state.skills.filter((s) => s.id !== req.params.id);
  for (const id of Object.keys(state.agentSkills)) state.agentSkills[id] = state.agentSkills[id].filter((x) => x !== req.params.id);
  return { ok: true };
}));

// ----------------------------------------------------------- conventions ----
app.get('/repos/:id/conventions', wrap((req) => {
  findRepo(req.params.id);
  return state.conventions[req.params.id] ?? [];
}));
app.post('/repos/:id/conventions/extract', wrap(async (req) => {
  const repo = findRepo(req.params.id);
  await sleep(2200);
  const list = (state.conventions[repo.id] ??= []);
  const fresh = [
    { rule: 'Async functions return typed Promises; no implicit any on exported APIs.', evidence_path: 'src/index.ts', evidence_snippet: 'export async function main(): Promise<void> {', confidence: 0.81 },
    { rule: 'Configuration is read once in src/config.ts — never process.env elsewhere.', evidence_path: 'src/config.ts', evidence_snippet: 'export const config = { port: Number(process.env.PORT ?? 8080) }', confidence: 0.74 },
    { rule: 'Test files mirror the src/ tree under test/ with a .test.ts suffix.', evidence_path: 'test/index.test.ts', evidence_snippet: "describe('main', () => {", confidence: 0.69 },
  ].filter((c) => !list.some((x) => x.rule === c.rule));
  list.push(...fresh.map((c) => ({ id: uuid(), accepted: false, ...c })));
  return list;
}));
app.post('/conventions/:id/accept', wrap((req) => {
  for (const [repoId, list] of Object.entries(state.conventions)) {
    const c = list.find((x) => x.id === req.params.id);
    if (!c) continue;
    c.accepted = true;
    const repo = state.repos.find((r) => r.id === repoId);
    const skill = createSkill({
      name: `convention-${c.rule.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')}`,
      description: c.rule, type: 'convention', source: 'extracted',
      body: `# Convention (${repo?.full_name ?? 'repo'})\n\n${c.rule}\n\n**Evidence** — \`${c.evidence_path}\`\n\n\`\`\`ts\n${c.evidence_snippet}\n\`\`\``,
      enabled: true, evidence_files: [c.evidence_path],
    });
    return { convention: c, skill };
  }
  throw notFound('Convention');
}));
app.delete('/conventions/:id', wrap((req) => {
  for (const id of Object.keys(state.conventions)) state.conventions[id] = state.conventions[id].filter((c) => c.id !== req.params.id);
  return { ok: true };
}));

// ---------------------------------------------------------------- memory ----
app.get('/memory', wrap((req) => {
  const { q = '', scope = '', kind = '', repo = '' } = req.query;
  const needle = String(q).toLowerCase();
  return state.memory.filter((m) =>
    (!needle || m.content.toLowerCase().includes(needle)) &&
    (!scope || String(scope).split(',').includes(m.scope)) &&
    (!kind || String(kind).split(',').includes(m.kind)) &&
    (!repo || m.repo === repo || m.scope !== 'repo'));
}));
app.get('/memory/:id', wrap((req) => state.memory.find((m) => m.id === req.params.id) ?? (() => { throw notFound('Memory item'); })()));
app.post('/memory', wrap((req, res) => {
  const { content, scope = 'repo', kind = 'fact', repo = null } = req.body ?? {};
  if (!content?.trim()) throw bad('content is required');
  const now = new Date().toISOString();
  const item = { id: uuid(), content, scope, kind, confidence: 1, sources: [{ pr: null, context: 'Added manually' }], repo, created_at: now, updated_at: now, last_used_at: null };
  state.memory.unshift(item);
  res.status(201);
  return item;
}));
app.put('/memory/:id', wrap((req) => {
  const m = state.memory.find((x) => x.id === req.params.id);
  if (!m) throw notFound('Memory item');
  for (const k of ['content', 'scope', 'kind']) if (req.body?.[k] !== undefined) m[k] = req.body[k];
  m.updated_at = new Date().toISOString();
  return m;
}));
app.delete('/memory/:id', wrap((req) => {
  state.memory = state.memory.filter((m) => m.id !== req.params.id);
  return { ok: true };
}));

// ------------------------------------------------------- project context ----
app.get('/repos/:id/context', wrap((req) => {
  findRepo(req.params.id);
  return state.context[req.params.id] ?? [];
}));
app.get('/repos/:id/context/status', wrap((req) => {
  findRepo(req.params.id);
  return state.contextStatus[req.params.id];
}));
app.put('/repos/:id/context', wrap((req) => {
  findRepo(req.params.id);
  const { path, content } = req.body ?? {};
  if (!path || typeof content !== 'string') throw bad('path and content are required');
  const list = (state.context[req.params.id] ??= []);
  const now = new Date().toISOString();
  const existing = list.find((s) => s.path === path);
  if (existing) Object.assign(existing, { content, size: Buffer.byteLength(content), updated_at: now });
  else list.push({ path, content, size: Buffer.byteLength(content), updated_at: now });
  return list.find((s) => s.path === path);
}));
app.post('/repos/:id/context/reindex', wrap(async (req) => {
  findRepo(req.params.id);
  await sleep(1500);
  const n = (state.context[req.params.id] ?? []).length;
  state.contextStatus[req.params.id] = n
    ? { status: 'done', pct: 100, message: `${n} spec files indexed`, chunks_indexed: n * 7 }
    : { status: 'idle', pct: 0, message: 'No spec files yet', chunks_indexed: 0 };
  return state.contextStatus[req.params.id];
}));

// ------------------------------------------------------------- fallback ----
app.use((req, _res, next) => next(new HttpError(404, 'not_found', `Route ${req.method} ${req.path} is not mocked`)));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: { code: err.code ?? 'internal_error', message: err.message ?? 'Internal error' } });
});

app.listen(PORT, () => {
  console.log(`DevDigest mock API → http://localhost:${PORT}  (web expected on :${WEB_PORT})`);
  console.log(`  ${state.repos.length} repos · ${state.pulls.length} PRs · ${state.agents.length} agents · ${state.skills.length} skills · ${state.memory.length} memories`);
  console.log('  POST /__reset restores the demo data.');
});

