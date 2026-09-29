# CLAUDE.md

@AGENTS.md

- Verify UI changes by running `npm run dev` and opening the affected page; run `npm run typecheck` and `npm test` before calling work done.
- Keep the mock (`mock-server/`) and the client in sync: every hook's endpoint must exist in `mock-server/src/server.js`.
- Never add real network calls, API keys or secrets — this repo must run fully offline after `npm install`.
