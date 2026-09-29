# DevDigest — UI demo on mock data

Web interface of **DevDigest** (a local-first AI pull-request reviewer) running
on an in-memory **mock API**. Every screen has data. You don't need Docker, a
database, LLM or GitHub keys, or internet access after install.

> Прототип интерфейса DevDigest на моковых данных. Нужен только Node.js — без БД, Docker и ключей.

## Quick start

Requirements: **Node.js 20.9+** (22 recommended) and npm.

```bash
git clone <this repo>
cd <repo>
npm install        # installs root + mock-server + client (postinstall)
npm run dev        # mock API → http://localhost:3001, UI → http://localhost:3000
```

Open **http://localhost:3000**. Stop both servers with `Ctrl+C`.

| Command | What it does |
|---|---|
| `npm run dev` | mock API + web UI together |
| `npm run api` / `npm run web` | run only one of them |
| `npm run build` | production build of the UI |
| `npm test` / `npm run typecheck` | client tests / TypeScript check |

Restarting the API, or `POST http://localhost:3001/__reset`, restores the demo data.
Ports 3000 and 3001 must be free. To use another API address, set
`NEXT_PUBLIC_API_BASE` (see `client/.env.example`).

## What you can try

- **Pull Requests.** 3 repos and 13 PRs in every status.
  - PR **#482** is the showcase: real diff, 3 agent reviews (secret leak, lethal
    trifecta, N+1, …), a failed and a cancelled run, full run traces, and inline
    comments.
- **Run Review.** Runs are simulated: a live log streams for about 6s, then a
  review is saved and the grounding gate drops one hallucinated finding. You can
  cancel a run.
- **Agents.** Config, **Skills** (link and order), **Prompt preview** (the exact
  prompt the model gets: system prompt → skills → memory → specs → repo map →
  callers → diff), and **Versions**.
- **Skills.** Library with versions and editing. Import from text, a URL or the
  community catalog; imported skills stay untrusted until vetted.
- **Conventions.** Extracted house rules with evidence. *Accept as Skill* turns
  one into a skill.
- **Memory.** Learned facts, decisions and preferences. Use the *Learn* button on
  a finding to add one.
- **Project Context.** Spec files with mermaid diagrams and repo-intel status.
- **Settings.** API-key status and per-feature models.

## Layout

```
client/        Next.js 16 + React 19 UI (design system in src/vendor/ui, i18n in messages/en)
mock-server/   Express mock of the DevDigest API — routes in src/server.js, data in src/data/
```

See `mock-server/README.md` for what is simulated and `AGENTS.md` for conventions.
