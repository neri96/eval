import type { EvalSession, Rollout, SessionEntry } from "@/shared/types";
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
  return comment.slice(0, COMMENT_MAX);
}

export function normalizeOperators(operators: string[]): string[] {
  return [
    ...new Set(operators.map((name) => name.trim()).filter(Boolean)),
  ].slice(0, MAX_OPERATORS);
}

/** A fresh, never-started rollout. */
export function makeRollout(index: number): Rollout {
  return {
    id: createId("rollout"),
    index,
    startedAt: now(),
    endedAt: null,
    outcome: null,
    accumulatedMs: 0,
    runningSince: null,
    entries: [],
  };
}

/** The current (last) rollout — the one the live clock and scoring act on. */
export function currentRollout(session: EvalSession): Rollout {
  return session.rollouts[session.rollouts.length - 1];
}

/**
 * A pristine session: never started, no model chosen, nothing scored. Such a
 * session is indistinguishable from a fresh one, so creating a "new" session
 * while one is sitting empty should reuse it rather than stack duplicates.
 */
export function isEmptySession(session: EvalSession): boolean {
  return (
    session.status === "initial" &&
    !session.model.trim() &&
    !session.title &&
    !session.comment &&
    session.rollouts.every((rollout) => rollout.entries.length === 0)
  );
}

/** Elapsed clock for a rollout, accounting for the live running segment. */
export function elapsedOf(rollout: Rollout): number {
  return rollout.runningSince
    ? rollout.accumulatedMs + (Date.now() - Date.parse(rollout.runningSince))
    : rollout.accumulatedMs;
}

/** Total elapsed across every rollout in a session. */
export function sessionElapsedMs(session: EvalSession): number {
  return session.rollouts.reduce((sum, rollout) => sum + elapsedOf(rollout), 0);
}

/** Flattened entry stream across every rollout (ordered by rollout, then entry). */
export function sessionEntries(session: EvalSession): SessionEntry[] {
  return session.rollouts.flatMap((rollout) => rollout.entries);
}

/** Bank the live running segment into accumulatedMs and stop the clock (mutates). */
export function bank(rollout: Rollout) {
  if (rollout.runningSince) {
    rollout.accumulatedMs += Date.now() - Date.parse(rollout.runningSince);
    rollout.runningSince = null;
  }
}

/** Stop the outgoing current session before a new/resumed one takes over (legacy archive). */
export function finalizeOutgoing(session: EvalSession) {
  if (session.status === "done" || session.status === "stopped") return;
  const rollout = currentRollout(session);
  bank(rollout);
  rollout.endedAt = now();
  session.status = "stopped";
  session.endedAt = now();
}

export function cloneSession(session: EvalSession): EvalSession {
  return structuredClone(session);
}

/** Legacy (v2) session shape: clock + entries lived at the top level. */
type LegacySession = EvalSession & {
  accumulatedMs?: number;
  runningSince?: string | null;
  entries?: SessionEntry[];
};

/**
 * v2 → v3 migration: wrap a flat session (top-level clock + entries) into a
 * single-rollout session. No-op for sessions that already have rollouts.
 */
export function ensureRollouts(session: EvalSession): EvalSession {
  if (Array.isArray(session.rollouts)) return session;
  const legacy = session as LegacySession;
  const rollout: Rollout = {
    id: createId("rollout"),
    index: 0,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    outcome: null,
    accumulatedMs: legacy.accumulatedMs ?? 0,
    runningSince: legacy.runningSince ?? null,
    entries: legacy.entries ?? [],
  };
  const next: LegacySession = { ...session, rollouts: [rollout] };
  delete next.accumulatedMs;
  delete next.runningSince;
  delete next.entries;
  return next;
}

/** On reload, freeze any rollout that was mid-run (legacy forced running=false on load). */
export function normalizeLoadedSession(session: EvalSession): EvalSession {
  const next = structuredClone(session);
  let wasRunning = false;
  for (const rollout of next.rollouts) {
    if (rollout.runningSince) {
      rollout.accumulatedMs += Date.now() - Date.parse(rollout.runningSince);
      rollout.runningSince = null;
      wasRunning = true;
    }
  }
  if (wasRunning && next.status === "active") next.status = "paused";
  return next;
}
