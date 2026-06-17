import type { EvalSession } from "@/shared/types";
import {
  COMMENT_MAX,
  DEFAULT_DURATION_SEC,
  MAX_DURATION_SEC,
  MAX_OPERATORS,
  MIN_DURATION_SEC,
  UNLIMITED_DURATION,
} from "@/shared/constants";

/* ------------------------------------------------------------------ *
 * Pure store helpers — no `set`/`get`, no React. Safe to unit-test
 * in isolation and to reuse from selectors.
 * ------------------------------------------------------------------ */

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function now() {
  return new Date().toISOString();
}

export function sanitizeDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_DURATION_SEC;
  if (seconds === UNLIMITED_DURATION) return UNLIMITED_DURATION;
  return Math.min(
    MAX_DURATION_SEC,
    Math.max(MIN_DURATION_SEC, Math.round(seconds)),
  );
}

export function sanitizeComment(comment: string): string {
  return comment.slice(0, COMMENT_MAX).trim();
}

export function normalizeOperators(operators: string[]): string[] {
  return [
    ...new Set(operators.map((name) => name.trim()).filter(Boolean)),
  ].slice(0, MAX_OPERATORS);
}

/** Elapsed clock for a session, accounting for the live running segment. */
export function elapsedOf(session: EvalSession): number {
  return session.runningSince
    ? session.accumulatedMs + (Date.now() - Date.parse(session.runningSince))
    : session.accumulatedMs;
}

/** Bank the live running segment into accumulatedMs and stop the clock (mutates). */
export function bank(session: EvalSession) {
  if (session.runningSince) {
    session.accumulatedMs += Date.now() - Date.parse(session.runningSince);
    session.runningSince = null;
  }
}

/** Stop the outgoing current session before a new/resumed one takes over (legacy archive). */
export function finalizeOutgoing(session: EvalSession) {
  if (session.status === "done" || session.status === "stopped") return;
  bank(session);
  session.status = "stopped";
  session.endedAt = now();
}

export function cloneSession(session: EvalSession): EvalSession {
  return structuredClone(session);
}

/** On reload, freeze any session that was mid-run (legacy forced running=false on load). */
export function normalizeLoadedSession(session: EvalSession): EvalSession {
  const next = structuredClone(session);
  if (next.runningSince) {
    next.accumulatedMs += Date.now() - Date.parse(next.runningSince);
    next.runningSince = null;
    if (next.status === "active") next.status = "paused";
  }
  return next;
}
