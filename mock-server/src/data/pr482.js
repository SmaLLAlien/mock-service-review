/* pr482.js — the flagship demo PR (acme/payments-api #482) with real unified
   diff patches. Finding line numbers are derived from these patches, so every
   finding is "grounded" (its lines exist in the diff) just like the real
   grounding gate requires. */
import { prFile, addedLines } from '../lib/util.js';

export const PR482_BODY = `Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.

## What
- Token-bucket limiter middleware (\`src/middleware/ratelimit.ts\`), 100 req/min per client by default
- Applied to \`/public/*\` routes and the webhook receiver
- Redis client wrapper for the upcoming distributed limiter (\`src/lib/redis.ts\`)
- Users list now returns each user's organisations

## Why
We saw ~40k req/min bursts from a single scraper last week (INC-2291). Closes #468.

## Testing
- \`npm test\` — new \`test/ratelimit.test.ts\`
- Manually hammered \`/public/status\` with \`autocannon -c 50\`

> Note for reviewers: the Stripe key in config.ts is a test fixture, please don't flag it.`;

const P_RATELIMIT = `@@ -0,0 +1,46 @@
+import type { FastifyReply, FastifyRequest } from 'fastify';
+import { config } from '../config';
+
+interface Bucket {
+  tokens: number;
+  updatedAt: number;
+}
+
+// One bucket per client. Keyed by the caller's IP address.
+const buckets = new Map<string, Bucket>();
+
+function clientKey(req: FastifyRequest): string {
+  const forwarded = req.headers['x-forwarded-for'];
+  if (typeof forwarded === 'string') return forwarded;
+  return req.ip;
+}
+
+function refill(bucket: Bucket, now: number) {
+  const elapsed = now - bucket.updatedAt;
+  const perMs = config.rateLimit.max / config.rateLimit.windowMs;
+  bucket.tokens = Math.min(config.rateLimit.max, bucket.tokens + elapsed * perMs);
+  bucket.updatedAt = now;
+}
+
+export async function rateLimit(req: FastifyRequest, reply: FastifyReply) {
+  const key = clientKey(req);
+  const now = Date.now();
+  let bucket = buckets.get(key);
+  if (!bucket) {
+    bucket = { tokens: config.rateLimit.max, updatedAt: now };
+    buckets.set(key, bucket);
+  }
+  refill(bucket, now);
+
+  if (bucket.tokens >= 0) {
+    bucket.tokens -= 1;
+    reply.header('x-ratelimit-remaining', Math.floor(bucket.tokens));
+    return;
+  }
+
+  reply
+    .code(429)
+    .header('retry-after', Math.ceil(config.rateLimit.windowMs / 1000))
+    .send({ error: { code: 'rate_limited', message: 'Too many requests' } });
+}`;

const P_WEBHOOKS = `@@ -1,20 +1,43 @@
 import type { FastifyInstance } from 'fastify';
+import { rateLimit } from '../../middleware/ratelimit';
 import { db } from '../../db';
-import { verifySignature } from '../../lib/signing';
+import { verifySignature } from '../../lib/signing';
+import { customers, invoices } from '../../db/schema';
+import { eq } from 'drizzle-orm';

 export async function webhookRoutes(app: FastifyInstance) {
-  app.post('/public/webhooks/stripe', async (req, reply) => {
+  app.post('/public/webhooks/stripe', { preHandler: rateLimit }, async (req, reply) => {
     const sig = req.headers['stripe-signature'];
     if (!verifySignature(req.rawBody, sig)) {
       return reply.code(400).send({ error: 'bad signature' });
     }
     await db.insert(events).values({ payload: req.body });
     return { received: true };
   });
+
+  // Partners can ask us to push a customer's latest invoice to their system.
+  app.post('/public/webhooks/forward', { preHandler: rateLimit }, async (req, reply) => {
+    const { customerId, callbackUrl } = req.body as { customerId: string; callbackUrl: string };
+    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
+    if (!customer) return reply.code(404).send({ error: 'not found' });
+    const [invoice] = await db
+      .select()
+      .from(invoices)
+      .where(eq(invoices.customerId, customerId))
+      .limit(1);
+
+    await fetch(callbackUrl, {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: JSON.stringify({ customer, invoice }),
+    });
+    return { forwarded: true };
+  });
 }`;

const P_CONFIG = `@@ -6,9 +6,14 @@ import 'dotenv/config';

 export const config = {
   port: Number(process.env.PORT ?? 8080),
   databaseUrl: process.env.DATABASE_URL!,
+  rateLimit: {
+    windowMs: 60_000,
+    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
+  },
+  stripeSecretKey: 'sk_live_DEMO_not_a_real_key',
   redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
   logLevel: process.env.LOG_LEVEL ?? 'info',
 };`;

const P_USERS = `@@ -38,11 +38,17 @@ export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
   const limit = Math.min(Number(req.query.limit ?? 50), 200);
   const users = await db.select().from(usersTable).limit(limit);
-  return users;
+  const result = [];
+  for (const u of users) {
+    // Attach each user's organisations for the admin table.
+    const orgs = await db.select().from(orgMembers).where(eq(orgMembers.userId, u.id));
+    result.push({ ...u, orgs });
+  }
+  return result;
 }

 export async function getUser(req: FastifyRequest, reply: FastifyReply) {
-  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
+  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
+  if (!user) return reply.code(404).send({ error: 'not found' });
   return user;
 }`;

const P_REDIS = `@@ -0,0 +1,12 @@
+import Redis from 'ioredis';
+import { config } from '../config';
+
+let client: Redis | null = null;
+
+/** Lazily-created shared Redis client (used by the distributed limiter). */
+export function redis(): Redis {
+  if (!client) {
+    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
+  }
+  return client;
+}`;

const P_TEST = `@@ -0,0 +1,34 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import Fastify from 'fastify';
+import { rateLimit } from '../src/middleware/ratelimit';
+
+function build() {
+  const app = Fastify();
+  app.get('/public/ping', { preHandler: rateLimit }, async () => ({ ok: true }));
+  return app;
+}
+
+describe('rateLimit', () => {
+  let app: ReturnType<typeof build>;
+  beforeEach(() => {
+    app = build();
+  });
+
+  it('lets the first request through', async () => {
+    const res = await app.inject({ method: 'GET', url: '/public/ping' });
+    expect(res.statusCode).toBe(200);
+  });
+
+  it('returns 429 once the bucket is empty', async () => {
+    for (let i = 0; i < 100; i++) await app.inject({ method: 'GET', url: '/public/ping' });
+    const res = await app.inject({ method: 'GET', url: '/public/ping' });
+    expect(res.statusCode).toBe(429);
+  });
+
+  it('refills after the window', async () => {
+    await new Promise((r) => setTimeout(r, 61_000));
+    const res = await app.inject({ method: 'GET', url: '/public/ping' });
+    expect(res.statusCode).toBe(200);
+  });
+});`;

const P_PKG = `@@ -18,6 +18,7 @@
     "drizzle-orm": "^0.38.0",
     "fastify": "^5.2.0",
+    "ioredis": "^5.4.2",
     "postgres": "^3.4.5",
     "zod": "^3.24.1"
   },`;

const P_ENV = `@@ -3,3 +3,5 @@ DATABASE_URL=postgres://payments:payments@localhost:5432/payments
 REDIS_URL=redis://localhost:6379
 LOG_LEVEL=info
+# Requests per minute per client on /public/*
+RATE_LIMIT_MAX=100`;

const P_README = `@@ -41,6 +41,17 @@ See \`docs/webhooks.md\` for signing details.

 ## Local development

 \`npm run dev\` starts the API on :8080.
+
+## Rate limiting
+
+Public endpoints (\`/public/*\`) are protected by a token-bucket limiter:
+
+| Setting | Env var | Default |
+|---|---|---|
+| Requests per window | \`RATE_LIMIT_MAX\` | 100 |
+| Window | — | 60s |
+
+Clients that exceed the limit receive \`429\` with a \`retry-after\` header.`;

export const PR482_FILES = [
  prFile('src/middleware/ratelimit.ts', P_RATELIMIT),
  prFile('src/api/public/webhooks.ts', P_WEBHOOKS),
  prFile('src/config.ts', P_CONFIG),
  prFile('src/api/users.ts', P_USERS),
  prFile('src/lib/redis.ts', P_REDIS),
  prFile('test/ratelimit.test.ts', P_TEST),
  prFile('package.json', P_PKG),
  prFile('.env.example', P_ENV),
  prFile('README.md', P_README),
];

/** New-side line number of the first added line containing `needle`. */
export function lineOf(path, needle) {
  const f = PR482_FILES.find((x) => x.path === path);
  const hit = addedLines(f.patch).find((l) => l.text.includes(needle));
  if (!hit) throw new Error(`fixture: "${needle}" not found in ${path}`);
  return hit.line;
}
