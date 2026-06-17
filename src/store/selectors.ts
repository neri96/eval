import type {
  AnomalyKind,
  EvalSession,
  HistorySort,
  Ticket,
} from "@/shared/types";
import { elapsedOf } from "./helpers";
import type { EvalStore } from "./evalStore";

/* ------------------------------------------------------------------ *
 * Selectors — pure `(state) => …` functions. Use as
 * `useEvalStore(selectCurrentSession)` in components.
 * ------------------------------------------------------------------ */

export const selectCurrentSession = (state: EvalStore): EvalSession | null =>
  state.currentSessionId
    ? (state.sessions.find((s) => s.id === state.currentSessionId) ?? null)
    : null;

export const selectCurrentElapsedMs = (state: EvalStore): number => {
  const session = selectCurrentSession(state);
  return session ? elapsedOf(session) : 0;
};

/** True when the running session has reached its (non-unlimited) target — UI tick should Finish. */
export const selectShouldAutoFinish = (state: EvalStore): boolean => {
  const session = selectCurrentSession(state);
  return (
    !!session &&
    session.status === "active" &&
    session.durationSec > 0 &&
    elapsedOf(session) >= session.durationSec * 1000
  );
};

export type SessionStats = {
  successes: number;
  fails: number;
  total: number;
  score: number | null;
  events: Record<AnomalyKind, number>;
};

export function getSessionStats(session: EvalSession): SessionStats {
  const events: Record<AnomalyKind, number> = {
    collision: 0,
    dropped: 0,
    phantom: 0,
    shaky: 0,
    random: 0,
  };
  let successes = 0;
  let fails = 0;
  for (const entry of session.entries) {
    if (entry.kind === "verdict") {
      if (entry.verdict === "success") successes += 1;
      else fails += 1;
    } else {
      events[entry.anomaly] += 1;
    }
  }
  const total = successes + fails;
  const score = total > 0 ? Math.round((successes / total) * 100) : null;
  return { successes, fails, total, score, events };
}

/* ------------------------------------------------------------------ *
 * History metrics, filtering & sorting (ported from legacy app.js).
 * ------------------------------------------------------------------ */

const WILSON_Z = 1.96;

export function wilsonBound(
  successes: number,
  total: number,
  side: "lower" | "upper",
): number {
  if (!total) return side === "lower" ? 0 : 1;
  const phat = successes / total;
  const z2 = WILSON_Z * WILSON_Z;
  const denom = 1 + z2 / total;
  const center = phat + z2 / (2 * total);
  const margin =
    WILSON_Z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total);
  const value =
    side === "lower" ? (center - margin) / denom : (center + margin) / denom;
  return Math.max(0, Math.min(1, value));
}

export type SessionMetrics = SessionStats & {
  elapsedMs: number;
  ratePerMinute: number;
  successRate: number | null;
  wilsonLower: number;
  wilsonUpper: number;
  qualityConfidence: number;
  riskConfidence: number;
};

export function getSessionMetrics(session: EvalSession): SessionMetrics {
  const stats = getSessionStats(session);
  const elapsedMs = elapsedOf(session);
  const minutes = elapsedMs / 60000;
  const ratePerMinute = minutes > 0 ? stats.total / minutes : 0;
  const successRate = stats.total > 0 ? stats.successes / stats.total : null;
  const wilsonLower = wilsonBound(stats.successes, stats.total, "lower");
  const wilsonUpper = wilsonBound(stats.successes, stats.total, "upper");
  return {
    ...stats,
    elapsedMs,
    ratePerMinute,
    successRate,
    wilsonLower,
    wilsonUpper,
    qualityConfidence: wilsonLower,
    riskConfidence: stats.total > 0 ? 1 - wilsonUpper : 0,
  };
}

export type SessionStatusGroup = "active" | "done" | "stopped";

/** Map a session's lifecycle status to its history tab (initial/active/paused → "active"). */
export function sessionStatusGroup(session: EvalSession): SessionStatusGroup {
  if (session.status === "done") return "done";
  if (session.status === "stopped") return "stopped";
  return "active";
}

export type HistoryCounts = {
  all: number;
  active: number;
  done: number;
  stopped: number;
};

export function historyCounts(sessions: EvalSession[]): HistoryCounts {
  const counts: HistoryCounts = { all: 0, active: 0, done: 0, stopped: 0 };
  for (const session of sessions) {
    counts.all += 1;
    counts[sessionStatusGroup(session)] += 1;
  }
  return counts;
}

const EPSILON = 1e-12;
const compareDesc = (a: number, b: number) =>
  Math.abs(a - b) <= EPSILON ? 0 : b - a;
const compareAsc = (a: number, b: number) =>
  Math.abs(a - b) <= EPSILON ? 0 : a - b;

function compareByDate(
  a: EvalSession,
  b: EvalSession,
  direction: "asc" | "desc",
): number {
  const at = Date.parse(a.startedAt) || 0;
  const bt = Date.parse(b.startedAt) || 0;
  return direction === "desc" ? bt - at : at - bt;
}

function sortSessions(
  sessions: EvalSession[],
  sort: HistorySort,
): EvalSession[] {
  const withMeta = sessions.map((session) => ({
    session,
    metrics: getSessionMetrics(session),
  }));
  withMeta.sort((left, right) => {
    const a = left.session;
    const b = right.session;
    const ma = left.metrics;
    const mb = right.metrics;
    if (sort === "oldest") return compareByDate(a, b, "asc");
    if (sort === "best") {
      const cmp = compareDesc(ma.qualityConfidence, mb.qualityConfidence);
      if (cmp) return cmp;
      if (mb.total !== ma.total) return mb.total - ma.total;
      if (ma.successRate !== null && mb.successRate !== null) {
        const rate = compareDesc(ma.successRate, mb.successRate);
        if (rate) return rate;
      }
      return compareByDate(a, b, "desc");
    }
    if (sort === "worst") {
      const cmp = compareDesc(ma.riskConfidence, mb.riskConfidence);
      if (cmp) return cmp;
      if (mb.total !== ma.total) return mb.total - ma.total;
      if (ma.successRate !== null && mb.successRate !== null) {
        const rate = compareAsc(ma.successRate, mb.successRate);
        if (rate) return rate;
      }
      return compareByDate(a, b, "desc");
    }
    if (sort === "fastest") {
      const cmp = compareDesc(ma.ratePerMinute, mb.ratePerMinute);
      if (cmp) return cmp;
      if (mb.total !== ma.total) return mb.total - ma.total;
      return compareByDate(a, b, "desc");
    }
    return compareByDate(a, b, "desc");
  });
  return withMeta.map((item) => item.session);
}

function ticketNameFor(state: EvalStore, ticketId: string | null): string {
  if (!ticketId) return "";
  return state.tickets.find((ticket) => ticket.id === ticketId)?.name ?? "";
}

function matchesSearch(state: EvalStore, session: EvalSession): boolean {
  const query = state.historySearch.trim().toLowerCase();
  if (!query) return true;
  return [
    session.title,
    session.model,
    session.comment,
    ticketNameFor(state, session.ticketId),
  ].some((value) => value.toLowerCase().includes(query));
}

function matchesTicket(state: EvalStore, session: EvalSession): boolean {
  const filter = state.historyTicketFilter;
  if (filter === "all") return true;
  if (filter === "ungrouped") return !session.ticketId;
  return session.ticketId === filter;
}

export function selectFilteredSessions(state: EvalStore): EvalSession[] {
  const filtered = state.sessions.filter(
    (session) =>
      (state.historyStatusFilter === "all" ||
        sessionStatusGroup(session) === state.historyStatusFilter) &&
      matchesSearch(state, session) &&
      matchesTicket(state, session),
  );
  return sortSessions(filtered, state.historySort);
}

export function selectCurrentTicket(state: EvalStore): Ticket | null {
  return state.currentTicketId
    ? (state.tickets.find((ticket) => ticket.id === state.currentTicketId) ??
        null)
    : null;
}
