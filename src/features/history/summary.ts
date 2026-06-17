import type { AnomalyKind, EvalSession, SessionColor } from "@/shared/types";
import { SESSION_COLORS } from "@/shared/constants";
import {
  getSessionMetrics,
  wilsonBound,
  type SessionMetrics,
} from "@/store/selectors";

/* Per-session summary rows (ported from legacy getSummaryBaseRows). */

export type SummaryRow = {
  session: EvalSession;
  metrics: SessionMetrics;
  model: string;
};

const scoreSort = (metrics: SessionMetrics) =>
  metrics.score === null ? -1 : metrics.score;

export function buildSummaryRows(sessions: EvalSession[]): SummaryRow[] {
  return sessions
    .map((session) => ({
      session,
      metrics: getSessionMetrics(session),
      model: session.model || "",
    }))
    .sort((a, b) => {
      const diff = scoreSort(b.metrics) - scoreSort(a.metrics);
      if (diff) return diff;
      return b.metrics.qualityConfidence - a.metrics.qualityConfidence;
    });
}

export function pickBest(rows: SummaryRow[]): SummaryRow | null {
  return rows[0] ?? null;
}

export function pickFastest(rows: SummaryRow[]): SummaryRow | null {
  return (
    [...rows].sort(
      (a, b) => b.metrics.ratePerMinute - a.metrics.ratePerMinute,
    )[0] ?? null
  );
}

/* By-model aggregation (ported from legacy buildModelComparisonRows). */

type ColorStat = {
  sessions: number;
  successes: number;
  total: number;
  scores: number[];
  avg: number | null;
  wilson: number;
};

export type ModelRow = {
  model: string;
  sessions: number;
  totalEvals: number;
  colors: Record<SessionColor, ColorStat>;
  overallRaw: number | null;
  overallConfidence: number;
  events: Record<AnomalyKind, number>;
  totalEvents: number;
};

function emptyColorStats(): Record<SessionColor, ColorStat> {
  return Object.fromEntries(
    SESSION_COLORS.map((color) => [
      color,
      {
        sessions: 0,
        successes: 0,
        total: 0,
        scores: [] as number[],
        avg: null,
        wilson: 0,
      },
    ]),
  ) as Record<SessionColor, ColorStat>;
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function buildModelRows(rows: SummaryRow[]): ModelRow[] {
  const map = new Map<string, ModelRow>();

  for (const row of rows) {
    const display = row.model.trim() || "NO MODEL";
    const key = display.toUpperCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        model: display,
        sessions: 0,
        totalEvals: 0,
        colors: emptyColorStats(),
        overallRaw: null,
        overallConfidence: 0,
        events: { collision: 0, dropped: 0, phantom: 0, shaky: 0, random: 0 },
        totalEvents: 0,
      };
      map.set(key, entry);
    }
    entry.sessions += 1;
    entry.totalEvals += row.metrics.total;
    (Object.keys(row.metrics.events) as AnomalyKind[]).forEach((name) => {
      entry.events[name] += row.metrics.events[name];
      entry.totalEvents += row.metrics.events[name];
    });
    const color = row.session.color;
    if (color) {
      const stat = entry.colors[color];
      stat.sessions += 1;
      stat.successes += row.metrics.successes;
      stat.total += row.metrics.total;
      if (row.metrics.score !== null) stat.scores.push(row.metrics.score);
    }
  }

  return [...map.values()]
    .map((entry) => {
      for (const color of SESSION_COLORS) {
        const stat = entry.colors[color];
        stat.avg = stat.scores.length ? mean(stat.scores) : null;
        stat.wilson = stat.total
          ? wilsonBound(stat.successes, stat.total, "lower")
          : 0;
      }
      const avgs = SESSION_COLORS.map((color) => entry.colors[color].avg).filter(
        (value): value is number => value !== null,
      );
      entry.overallRaw = avgs.length ? mean(avgs) : null;
      entry.overallConfidence =
        (SESSION_COLORS.reduce(
          (sum, color) => sum + entry.colors[color].wilson,
          0,
        ) /
          SESSION_COLORS.length) *
        100;
      return entry;
    })
    .sort((a, b) => b.overallConfidence - a.overallConfidence);
}

/* Clipboard text (ported, condensed). */

export function buildSessionClipboard(rows: SummaryRow[]): string {
  return rows
    .map((row, index) => {
      const metrics = row.metrics;
      const score = metrics.score === null ? "—" : metrics.score;
      const lines = [
        `${index + 1}. Model - ${row.model || "N/A"}${
          row.session.color ? ` (${row.session.color})` : ""
        };`,
        `Success - ${metrics.successes}; Fail - ${metrics.fails}; Total - ${metrics.total}; Score - ${score}.`,
      ];
      const notes = row.session.comment.replace(/\s+/g, " ").trim();
      if (notes) lines.push(`Notes: ${notes}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildModelClipboard(rows: ModelRow[]): string {
  return rows
    .map((row, index) => {
      const overall =
        row.overallRaw === null ? "—" : `${Math.round(row.overallRaw)}%`;
      const colorParts = SESSION_COLORS.filter(
        (color) => row.colors[color].avg !== null,
      ).map(
        (color) =>
          `${color[0].toUpperCase()}${color.slice(1)} - ${Math.round(
            row.colors[color].avg as number,
          )}%`,
      );
      const lines = [
        `${index + 1}. Model - ${row.model};`,
        `Overall avg - ${overall}; Confidence - ${row.overallConfidence.toFixed(1)}%; Sessions - ${row.sessions}; Evals - ${row.totalEvals}.`,
      ];
      if (colorParts.length) lines.push(colorParts.join("; ") + ".");
      return lines.join("\n");
    })
    .join("\n\n");
}
