/* util.js — small helpers shared by the fixtures and the routes. */
import { randomUUID } from 'node:crypto';

export const uuid = () => randomUUID();

/** ISO timestamp `n` minutes/hours/days before now (fixtures stay "fresh"). */
export const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString();
export const hoursAgo = (n) => minutesAgo(n * 60);
export const daysAgo = (n) => minutesAgo(n * 60 * 24);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deep clone plain JSON data. */
export const clone = (v) => structuredClone(v);

/** Pick a stable pseudo-random element from an array using a string seed. */
export function pick(arr, seed = '') {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

/** Short hex sha from any string (deterministic). */
export function fakeSha(seed) {
  let h1 = 0x811c9dc5;
  let out = '';
  for (let round = 0; round < 5; round++) {
    for (const ch of `${seed}:${round}`) h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
    out += h1.toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
}

/** Count +/- lines of a unified diff hunk body. */
export function countPatch(patch) {
  let additions = 0;
  let deletions = 0;
  for (const line of (patch ?? '').split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}

/** Build a PrFile, deriving additions/deletions from the patch. */
export function prFile(path, patch) {
  return { path, ...countPatch(patch), patch };
}

/** New-side line numbers of ADDED lines in a patch ([{line, text}]). */
export function addedLines(patch) {
  const out = [];
  let newLine = 0;
  for (const raw of (patch ?? '').split('\n')) {
    const m = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) {
      newLine = Number(m[1]);
      continue;
    }
    if (raw.startsWith('+')) {
      out.push({ line: newLine, text: raw.slice(1) });
      newLine++;
    } else if (raw.startsWith('-')) {
      /* old side only */
    } else {
      newLine++;
    }
  }
  return out;
}

/** Score formula used by reviewer-core: 100 − 35·C − 12·W − 3·S (clamped). */
export function scoreFor(findings) {
  let s = 100;
  for (const f of findings) {
    if (f.severity === 'CRITICAL') s -= 35;
    else if (f.severity === 'WARNING') s -= 12;
    else s -= 3;
  }
  return Math.max(0, Math.min(100, s));
}

export function verdictFor(findings) {
  if (findings.some((f) => f.severity === 'CRITICAL')) return 'request_changes';
  if (findings.length > 0) return 'comment';
  return 'approve';
}

/** Rough token estimate (chars / 4) for trace stats. */
export const tokens = (s) => Math.ceil((s ?? '').length / 4);

/** "00.31"-style elapsed label used by run logs. */
export const elapsed = (ms) => (ms / 1000).toFixed(2).padStart(5, '0');
