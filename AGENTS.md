# AGENTS.md — DevDigest UI demo

Guide for AI coding agents working in this repo. Keep it accurate when you change commands or structure.

## What this is
The DevDigest web UI (AI pull-request reviewer) running against an **in-memory Express mock API**. No database, no LLM, no GitHub. It is a prototype/MVP base: the UI is 1:1 with the upstream `dev-digest` project, plus prototype screens (Skills, Conventions, Memory, Project Context, agent Skills/Prompt preview/Versions tabs).

## Layout & commands
Plain npm everywhere (three `package-lock.json`: root, `client/`, `mock-server/`). Node ≥ 20.

| Path | Role | Port |
|---|---|---|
| `client/` | Next.js 15 App Router + React 19, React Query, next-intl | 3000 |
| `mock-server/` | Express 4, ESM JavaScript, in-memory state | 3001 |

```bash
npm install          # root postinstall installs client + mock-server
npm run dev          # both (concurrently)
npm run typecheck    # client tsc
npm test             # client vitest (jsdom, fetch mocked)
npm run build        # client production build
```

## Client conventions
- Thin `page.tsx`; feature code in co-located `_components/<PascalName>/` with `<Name>.tsx`, `index.ts` barrel, optional `styles.ts` / `constants.ts` / `helpers.ts` / `<Name>.test.tsx`.
- Styling: inline style objects using CSS variables from `src/vendor/ui/styles.css` (`var(--accent)`, `var(--border)`, `var(--crit)` …), kept in `styles.ts` as `export const s = { … } as const` with `satisfies CSSProperties`. Don't add Tailwind classes or hard-coded colours.
- UI primitives come from `@devdigest/ui` (`src/vendor/ui`, import from the barrel). Icon names = keys of `Icon` in `src/vendor/ui/icons.tsx` (e.g. `Edit`, not `Pencil`).
- Data: `src/lib/api.ts` + React Query hooks in `src/lib/hooks/*` (`core`, `agents`, `reviews`, `trace`, `repo-intel`, `knowledge`). Contracts: types from `@devdigest/shared` (`src/vendor/shared`) — import **types only**.
- Strings: `next-intl`, one JSON per feature in `client/messages/en/<ns>.json`.
- Sidebar nav: `src/vendor/ui/nav.ts`. Filters/tabs live in URL search params.
- TS: `strict`, `noUncheckedIndexedAccess`.

## Mock API conventions
- Routes in `mock-server/src/server.js` mirror the real DevDigest API paths and snake_case DTO shapes (contracts in `client/src/vendor/shared/contracts`). Errors: `{ error: { code, message } }`.
- Demo data is built in `src/data/seed.js` (+ `pr482.js`, `knowledge.js`); `src/lib/engine.js` simulates reviews (SSE log, traces, grounded findings); `src/lib/prompt.js` mirrors the upstream `reviewer-core` prompt assembly.
- A new UI feature needing data = add the route + fixtures here, then the hook in `client/src/lib/hooks`.

## Definition of done
`npm run typecheck` and `npm test` pass; new strings in `messages/en`; the page renders against the mock with no console errors.
