import type { EvalSession, SessionColor } from "@/shared/types";
import { SESSION_COLORS } from "@/shared/constants";
import { POSITIONS } from "@/shared/grid";
import { getTask } from "@/shared/tasks";
import {
  getAttempts,
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

/* Cube-in-bowl position analytics. */

type PositionStat = {
  cell: string;
  total: number;
  successes: number;
  fails: number;
};

export type CubeHeatmapCell = PositionStat & {
  count: number;
  rate: number | null;
};

type CombinationStat = {
  cubeCell: string;
  bowlCell: string;
  total: number;
  successes: number;
  fails: number;
};

export type CubeCombinationCell = CombinationStat & {
  count: number;
  rate: number | null;
};

export type CubePositionAnalytics = {
  totalAttempts: number;
  cubeStart: CubeHeatmapCell[];
  bowlTarget: CubeHeatmapCell[];
  cubeBowl: CubeCombinationCell[];
};

function emptyPositionStats(): Map<string, PositionStat> {
  return new Map(
    POSITIONS.map((position) => [
      position.cell,
      {
        cell: position.cell,
        total: 0,
        successes: 0,
        fails: 0,
      },
    ]),
  );
}

function toHeatmapCells(
  stats: Map<string, PositionStat>,
): CubeHeatmapCell[] {
  return POSITIONS.map((position) => {
    const stat = stats.get(position.cell)!;
    return {
      ...stat,
      count: stat.successes,
      rate: stat.total > 0 ? (stat.successes / stat.total) * 100 : null,
    };
  });
}

const comboKey = (cubeCell: string, bowlCell: string) =>
  `${cubeCell}->${bowlCell}`;

function emptyCombinationStats(): Map<string, CombinationStat> {
  const stats = new Map<string, CombinationStat>();
  for (const cube of POSITIONS) {
    for (const bowl of POSITIONS) {
      stats.set(comboKey(cube.cell, bowl.cell), {
        cubeCell: cube.cell,
        bowlCell: bowl.cell,
        total: 0,
        successes: 0,
        fails: 0,
      });
    }
  }
  return stats;
}

function toCombinationCells(
  stats: Map<string, CombinationStat>,
): CubeCombinationCell[] {
  return POSITIONS.flatMap((cube) =>
    POSITIONS.map((bowl) => {
      const stat = stats.get(comboKey(cube.cell, bowl.cell))!;
      return {
        ...stat,
        count: stat.successes,
        rate: stat.total > 0 ? (stat.successes / stat.total) * 100 : null,
      };
    }),
  );
}

export function buildCubePositionAnalytics(
  rows: SummaryRow[],
): CubePositionAnalytics {
  const validCells = new Set<string>(
    POSITIONS.map((position) => position.cell),
  );
  const cubeStats = emptyPositionStats();
  const bowlStats = emptyPositionStats();
  const combinationStats = emptyCombinationStats();
  let totalAttempts = 0;

  const add = (
    stats: Map<string, PositionStat>,
    cell: string | null,
    result: "success" | "fail",
  ) => {
    if (!cell || !validCells.has(cell)) return;
    const stat = stats.get(cell);
    if (!stat) return;
    stat.total += 1;
    if (result === "success") stat.successes += 1;
    else stat.fails += 1;
  };

  const addCombination = (
    cubeCell: string | null,
    bowlCell: string | null,
    result: "success" | "fail",
  ) => {
    if (
      !cubeCell ||
      !bowlCell ||
      !validCells.has(cubeCell) ||
      !validCells.has(bowlCell)
    ) {
      return;
    }
    const stat = combinationStats.get(comboKey(cubeCell, bowlCell));
    if (!stat) return;
    stat.total += 1;
    if (result === "success") stat.successes += 1;
    else stat.fails += 1;
  };

  for (const row of rows) {
    for (const attempt of getAttempts(row.session)) {
      if (!attempt.result) continue;
      totalAttempts += 1;
      add(cubeStats, attempt.cubePosition, attempt.result);
      add(bowlStats, attempt.bowlPosition, attempt.result);
      addCombination(
        attempt.cubePosition,
        attempt.bowlPosition,
        attempt.result,
      );
    }
  }

  return {
    totalAttempts,
    cubeStart: toHeatmapCells(cubeStats),
    bowlTarget: toHeatmapCells(bowlStats),
    cubeBowl: toCombinationCells(combinationStats),
  };
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
  events: Record<string, number>;
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
        events: {},
        totalEvents: 0,
      };
      map.set(key, entry);
    }
    entry.sessions += 1;
    entry.totalEvals += row.metrics.total;
    Object.entries(row.metrics.events).forEach(([name, count]) => {
      entry.events[name] = (entry.events[name] ?? 0) + count;
      entry.totalEvents += count;
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
      const avgs = SESSION_COLORS.map(
        (color) => entry.colors[color].avg,
      ).filter((value): value is number => value !== null);
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

export type ReportFormat = "brief" | "detailed" | "slack";

function formatWholePercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function modelBreakdown(row: ModelRow): Array<[string, string]> {
  return SESSION_COLORS.map((color) => [
    `${color[0].toUpperCase()}${color.slice(1)}`,
    formatWholePercent(row.colors[color].avg),
  ]);
}

function buildModelReportBlock(
  row: ModelRow,
  format: ReportFormat,
  index?: number,
): string {
  const prefix = index === undefined ? "" : `${index + 1}. `;
  const overall = formatWholePercent(row.overallRaw);
  const breakdown = modelBreakdown(row);

  if (format === "brief") {
    return [
      `${prefix}Model ${row.model}`,
      `• Overall avg: ${overall}`,
      `• Breakdown: ${breakdown
        .map(([label, value]) => `${label}: ${value}`)
        .join(" · ")}`,
    ].join("\n");
  }

  if (format === "slack") {
    return [
      `${prefix}*Model \`${row.model}\`*`,
      `• Overall avg: \`${overall}\``,
      `• Confidence: \`${row.overallConfidence.toFixed(1)}%\``,
      `• Sessions: \`${row.sessions}\``,
      `• Evals: \`${row.totalEvals}\``,
      "",
      "*Breakdown*",
      ...breakdown.map(([label, value]) => `• ${label}: \`${value}\``),
    ].join("\n");
  }

  return [
    `${prefix}Model ${row.model}`,
    `• Overall avg: ${overall}`,
    `• Confidence: ${row.overallConfidence.toFixed(1)}%`,
    `• Sessions: ${row.sessions}`,
    `• Evals: ${row.totalEvals}`,
    `• Breakdown: ${breakdown
      .map(([label, value]) => `${label}: ${value}`)
      .join(" · ")}`,
  ].join("\n");
}

export function buildModelReportClipboard(
  rows: ModelRow[],
  format: ReportFormat,
): string {
  const enumerate = rows.length > 1;
  return rows
    .map((row, index) =>
      buildModelReportBlock(row, format, enumerate ? index : undefined),
    )
    .join("\n\n");
}

/* ------------------------------------------------------------------ *
 * Lego (multi-rollout) metrics & aggregation. Lego completes
 * deterministically, so it's scored by cost-to-completion — speed
 * (sec/piece), grasp efficiency (attempts/piece), rollout count, and the
 * event profile — never by a success rate or by color.
 * ------------------------------------------------------------------ */

export type LegoMetrics = {
  placed: number;
  failed: number;
  attempts: number;
  badGrasps: number; // successful but dirty placements
  goodEvents: number;
  badEvents: number;
  attemptsPerPiece: number | null; // lower is better
  secPerPiece: number | null; // lower is better
  piecesPerMin: number; // higher is better
  totalTimeMs: number;
  rollouts: number; // fewer is better (each extra = a glitch)
  cleanRollouts: number;
  glitchedRollouts: number;
  events: Record<string, number>; // event profile (excludes bad_grasp + glitch)
  totalEvents: number;
};

export type LegoRow = {
  session: EvalSession;
  metrics: LegoMetrics;
  model: string;
};

export type LegoSummarySortDirection = "best" | "worst";

const LEGO_EVENTS = getTask("lego-transfer").events;
const LEGO_EVENT_LABELS = Object.fromEntries(
  LEGO_EVENTS.map((event) => [event.id, event.label]),
) as Record<string, string>;
const LEGO_EVENT_VALENCE = Object.fromEntries(
  LEGO_EVENTS.map((event) => [event.id, event.valence]),
) as Record<string, "positive" | "negative">;

// Counted as their own categories, so they're excluded from the event profile.
const SPECIAL_EVENT_IDS = new Set(["bad_grasp", "glitch"]);

/** Event counts with the specially-tracked ids (bad grasp, glitch) removed. */
export function eventProfile(
  events: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(events)) {
    if (!SPECIAL_EVENT_IDS.has(id) && count > 0) out[id] = count;
  }
  return out;
}

export function getLegoMetrics(session: EvalSession): LegoMetrics {
  const m = getSessionMetrics(session);
  const placed = m.successes;
  const attempts = m.total;
  const totalTimeMs = m.elapsedMs;
  let cleanRollouts = 0;
  let glitchedRollouts = 0;
  for (const rollout of session.rollouts) {
    if (rollout.outcome === "clean") cleanRollouts += 1;
    else if (rollout.outcome === "glitched") glitchedRollouts += 1;
  }
  const profile = eventProfile(m.events);
  const totalEvents = Object.values(profile).reduce((sum, n) => sum + n, 0);
  let goodEvents = 0;
  let badEvents = 0;
  for (const [id, count] of Object.entries(profile)) {
    if (count <= 0) continue;
    if (LEGO_EVENT_VALENCE[id] === "positive") goodEvents += count;
    else badEvents += count;
  }
  return {
    placed,
    failed: m.fails,
    attempts,
    badGrasps: m.events["bad_grasp"] ?? 0,
    goodEvents,
    badEvents,
    attemptsPerPiece: placed > 0 ? attempts / placed : null,
    secPerPiece: placed > 0 ? totalTimeMs / 1000 / placed : null,
    piecesPerMin: totalTimeMs > 0 ? placed / (totalTimeMs / 60000) : 0,
    totalTimeMs,
    rollouts: session.rollouts.length,
    cleanRollouts,
    glitchedRollouts,
    events: profile,
    totalEvents,
  };
}

function legoCompositeScore(metrics: LegoMetrics): number {
  const successRate =
    metrics.attempts > 0 ? metrics.placed / metrics.attempts : 0;
  const speed =
    metrics.secPerPiece === null ? 0 : 1 / Math.max(0.01, metrics.secPerPiece);
  const efficiency =
    metrics.attemptsPerPiece === null
      ? 0
      : 1 / Math.max(0.01, metrics.attemptsPerPiece);
  const badGraspRate =
    metrics.placed > 0
      ? metrics.badGrasps / metrics.placed
      : metrics.badGrasps
        ? 1
        : 0;
  const glitchRate =
    metrics.rollouts > 0 ? metrics.glitchedRollouts / metrics.rollouts : 0;
  const valenceBalance =
    (metrics.goodEvents - metrics.badEvents) /
    Math.max(1, metrics.goodEvents + metrics.badEvents);

  return (
    speed * 36 +
    efficiency * 26 +
    successRate * 20 +
    (1 - Math.min(1, badGraspRate)) * 8 +
    ((valenceBalance + 1) / 2) * 6 +
    (1 - Math.min(1, glitchRate)) * 4
  );
}

function compareLegoRows(
  a: LegoRow,
  b: LegoRow,
  direction: LegoSummarySortDirection,
): number {
  const scoreDelta =
    legoCompositeScore(b.metrics) - legoCompositeScore(a.metrics);
  if (scoreDelta) return direction === "best" ? scoreDelta : -scoreDelta;
  const speedDelta = bySecPerPiece(
    a.metrics.secPerPiece,
    b.metrics.secPerPiece,
  );
  if (speedDelta) return direction === "best" ? speedDelta : -speedDelta;
  return b.metrics.placed - a.metrics.placed;
}

// Sort by speed (sec/piece asc); sessions with no placed pieces sink to the end.
const bySecPerPiece = (a: number | null, b: number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

export function buildLegoRows(
  sessions: EvalSession[],
  direction: LegoSummarySortDirection = "best",
): LegoRow[] {
  return sessions
    .map((session) => ({
      session,
      metrics: getLegoMetrics(session),
      model: session.model || "",
    }))
    .sort((a, b) => compareLegoRows(a, b, direction));
}

export function pickFastestLego(rows: LegoRow[]): LegoRow | null {
  return (
    [...rows].sort((a, b) =>
      bySecPerPiece(a.metrics.secPerPiece, b.metrics.secPerPiece),
    )[0] ?? null
  );
}

export function pickEfficientLego(rows: LegoRow[]): LegoRow | null {
  return (
    [...rows]
      .filter((row) => row.metrics.attemptsPerPiece !== null)
      .sort(
        (a, b) =>
          (a.metrics.attemptsPerPiece as number) -
          (b.metrics.attemptsPerPiece as number),
      )[0] ?? null
  );
}

export type LegoModelRow = {
  model: string;
  sessions: number;
  placed: number;
  failed: number;
  attempts: number;
  badGrasps: number;
  goodEvents: number;
  badEvents: number;
  rollouts: number;
  glitchedRollouts: number;
  totalTimeMs: number;
  secPerPiece: number | null;
  attemptsPerPiece: number | null;
  piecesPerMin: number;
  events: Record<string, number>;
  totalEvents: number;
};

export type LegoReportFormat = ReportFormat;

function legoModelCompositeScore(row: LegoModelRow): number {
  const attempts = row.attempts;
  const successRate = attempts > 0 ? row.placed / attempts : 0;
  const speed =
    row.secPerPiece === null ? 0 : 1 / Math.max(0.01, row.secPerPiece);
  const efficiency =
    row.attemptsPerPiece === null
      ? 0
      : 1 / Math.max(0.01, row.attemptsPerPiece);
  const badGraspRate =
    row.placed > 0 ? row.badGrasps / row.placed : row.badGrasps ? 1 : 0;
  const glitchRate = row.rollouts > 0 ? row.glitchedRollouts / row.rollouts : 0;
  const valenceBalance =
    (row.goodEvents - row.badEvents) /
    Math.max(1, row.goodEvents + row.badEvents);

  return (
    speed * 36 +
    efficiency * 26 +
    successRate * 20 +
    (1 - Math.min(1, badGraspRate)) * 8 +
    ((valenceBalance + 1) / 2) * 6 +
    (1 - Math.min(1, glitchRate)) * 4
  );
}

export function buildLegoModelRows(
  rows: LegoRow[],
  direction: LegoSummarySortDirection = "best",
): LegoModelRow[] {
  const map = new Map<string, LegoModelRow>();
  for (const row of rows) {
    const display = row.model.trim() || "NO MODEL";
    const key = display.toUpperCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        model: display,
        sessions: 0,
        placed: 0,
        failed: 0,
        attempts: 0,
        badGrasps: 0,
        goodEvents: 0,
        badEvents: 0,
        rollouts: 0,
        glitchedRollouts: 0,
        totalTimeMs: 0,
        secPerPiece: null,
        attemptsPerPiece: null,
        piecesPerMin: 0,
        events: {},
        totalEvents: 0,
      };
      map.set(key, entry);
    }
    entry.sessions += 1;
    entry.placed += row.metrics.placed;
    entry.failed += row.metrics.failed;
    entry.attempts += row.metrics.attempts;
    entry.badGrasps += row.metrics.badGrasps;
    entry.goodEvents += row.metrics.goodEvents;
    entry.badEvents += row.metrics.badEvents;
    entry.rollouts += row.metrics.rollouts;
    entry.glitchedRollouts += row.metrics.glitchedRollouts;
    entry.totalTimeMs += row.metrics.totalTimeMs;
    for (const [id, count] of Object.entries(row.metrics.events)) {
      entry.events[id] = (entry.events[id] ?? 0) + count;
      entry.totalEvents += count;
    }
  }
  return [...map.values()]
    .map((entry) => {
      entry.secPerPiece =
        entry.placed > 0 ? entry.totalTimeMs / 1000 / entry.placed : null;
      entry.attemptsPerPiece =
        entry.placed > 0 ? entry.attempts / entry.placed : null;
      entry.piecesPerMin =
        entry.totalTimeMs > 0 ? entry.placed / (entry.totalTimeMs / 60000) : 0;
      return entry;
    })
    .sort((a, b) => {
      const scoreDelta =
        legoModelCompositeScore(b) - legoModelCompositeScore(a);
      if (scoreDelta) return direction === "best" ? scoreDelta : -scoreDelta;
      const speedDelta = bySecPerPiece(a.secPerPiece, b.secPerPiece);
      return direction === "best" ? speedDelta : -speedDelta;
    });
}

const fmtSec = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}s`;
const fmtAtt = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

function fmtOperators(operators: string[]): string {
  return operators.length ? operators.join(", ") : "—";
}

function sortedEventEntries(
  events: Record<string, number>,
): Array<[string, number]> {
  return Object.entries(events)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatLegoEventList(
  events: Record<string, number>,
  extras: Array<[string, number]> = [],
): string {
  const parts = sortedEventEntries(events).map(
    ([id, count]) => `${LEGO_EVENT_LABELS[id] ?? id} x${count}`,
  );
  for (const [label, count] of extras) {
    if (count > 0) parts.push(`${label} x${count}`);
  }
  return parts.length ? parts.join("; ") : "None";
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatSecPerPiece(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}s / piece`;
}

function formatComment(comments: string[]): string {
  return comments.length ? comments.join(" / ") : "—";
}

function formatEventLines(row: LegoModelRow): string[] {
  const events = sortedEventEntries(row.events);
  if (!events.length) return ["• None"];
  return events.map(([id, count]) => {
    const label = LEGO_EVENT_LABELS[id] ?? id;
    return `• ${label}: ${count}`;
  });
}

function tick(value: string): string {
  return `\`${value}\``;
}

function buildLegoModelReportBlock(
  row: LegoModelRow,
  format: LegoReportFormat,
  options?: { comments?: string[]; operators?: string[] },
  index?: number,
): string {
  const successRate =
    row.attempts > 0 ? (row.placed / row.attempts) * 100 : null;
  const rate = formatPercent(successRate);
  const speed = formatSecPerPiece(row.secPerPiece);
  const comments = options?.comments ?? [];
  const operators = options?.operators ?? [];
  const prefix = index === undefined ? "" : `${index + 1}. `;

  if (format === "brief") {
    return [
      `${prefix}Model ${row.model}`,
      `• Success rate: ${rate} — ${row.placed} / ${row.attempts}`,
      `• Failures: ${row.failed}`,
      `• Speed: ${speed}`,
    ].join("\n");
  }

  const isSlack = format === "slack";
  const modelLine = isSlack
    ? `${prefix}*Model ${tick(row.model)}*`
    : `${prefix}Model ${row.model}`;
  const section = (label: string) => (isSlack ? `*${label}*` : label);
  const metric = (value: string) => (isSlack ? tick(value) : value);
  const lines = [
    modelLine,
    "",
    section("Performance"),
    `• Success rate: ${metric(rate)} — ${metric(`${row.placed} / ${row.attempts}`)}`,
    `• Failures: ${metric(`${row.failed}`)}`,
    `• Speed: ${metric(speed)}`,
    "",
    section("Session"),
    `• Rollouts: ${metric(`${row.rollouts}`)}`,
    `• Sessions: ${metric(`${row.sessions}`)}`,
    "",
    section("Issues"),
    `• Bad grasps: ${metric(`${row.badGrasps}`)}`,
    `• Glitches: ${metric(`${row.glitchedRollouts}`)}`,
    "",
    section("Events"),
    ...formatEventLines(row),
  ];

  if (comments.length) {
    lines.push("", section("Comment"), `• ${formatComment(comments)}`);
  }
  if (operators.length) {
    lines.push("", section("Operators"), `• ${fmtOperators(operators)}`);
  }

  return lines.join("\n");
}

export function buildLegoModelReportClipboard(
  rows: LegoModelRow[],
  format: LegoReportFormat,
  options?: {
    commentsByModel?: Record<string, string[]>;
    operatorsByModel?: Record<string, string[]>;
  },
): string {
  const enumerate = rows.length > 1;
  return rows
    .map((row, index) =>
      buildLegoModelReportBlock(
        row,
        format,
        {
          comments: options?.commentsByModel?.[row.model] ?? [],
          operators: options?.operatorsByModel?.[row.model] ?? [],
        },
        enumerate ? index : undefined,
      ),
    )
    .join("\n\n");
}

export function buildLegoSessionClipboard(
  rows: LegoRow[],
  options?: { getOperators?: (session: EvalSession) => string[] },
): string {
  return rows
    .map((row, index) => {
      const m = row.metrics;
      const operators = options?.getOperators?.(row.session) ?? [];
      const lines = [
        `${index + 1}. Model - ${row.model || "N/A"};`,
        `Sec/piece - ${fmtSec(m.secPerPiece)}; Att/piece - ${fmtAtt(
          m.attemptsPerPiece,
        )}; Pieces/min - ${m.piecesPerMin.toFixed(2)}; Success/Fail - ${m.placed}/${m.failed}; Attempts - ${m.attempts}; Bad grasps - ${m.badGrasps}.`,
        `Rollouts - ${m.rollouts}; Glitches - ${m.glitchedRollouts}; Events - ${m.totalEvents}.`,
        `Events: ${formatLegoEventList(m.events, [
          ["Bad Grasp", m.badGrasps],
          ["Glitch", m.glitchedRollouts],
        ])}.`,
        `Operators: ${fmtOperators(operators)}.`,
      ];
      const notes = row.session.comment.replace(/\s+/g, " ").trim();
      if (notes) lines.push(`Notes: ${notes}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildLegoModelClipboard(
  rows: LegoModelRow[],
  options?: { operatorsByModel?: Record<string, string[]> },
): string {
  return rows
    .map((row, index) => {
      const operators = options?.operatorsByModel?.[row.model] ?? [];
      return [
        `${index + 1}. Model - ${row.model};`,
        `Sec/piece - ${fmtSec(row.secPerPiece)}; Att/piece - ${fmtAtt(
          row.attemptsPerPiece,
        )}; Pieces/min - ${row.piecesPerMin.toFixed(2)}; Success/Fail - ${row.placed}/${row.failed}; Attempts - ${row.attempts}; Bad grasps - ${row.badGrasps}.`,
        `Rollouts - ${row.rollouts}; Glitches - ${row.glitchedRollouts}; Events - ${row.totalEvents}; Sessions - ${row.sessions}.`,
        `Events: ${formatLegoEventList(row.events, [
          ["Bad Grasp", row.badGrasps],
          ["Glitch", row.glitchedRollouts],
        ])}.`,
        `Operators: ${fmtOperators(operators)}.`,
      ].join("\n");
    })
    .join("\n\n");
}
