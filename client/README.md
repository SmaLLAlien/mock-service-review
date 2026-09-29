# DevDigest web (client)

Next.js 15 (App Router) + React 19 UI. In this repo it talks to the mock API in
`../mock-server` (default `http://localhost:3001`, override with
`NEXT_PUBLIC_API_BASE`).

```bash
npm run dev        # http://localhost:3000
npm test           # vitest + jsdom (fetch mocked)
npm run typecheck
```

- Design system: `src/vendor/ui` (import from `@devdigest/ui`)
- Shared contracts (types only): `src/vendor/shared` (`@devdigest/shared`)
- Data hooks: `src/lib/hooks/*`; strings: `messages/en/*.json`
