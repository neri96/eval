import type { EvalSession, SessionEntry, Ticket } from "@/shared/types";
import {
  getAttempts,
  getSessionMetrics,
  sessionStatusGroup,
} from "@/store/selectors";
import { getLegoMetrics } from "@/features/history/summary";
import { sessionEntries } from "@/store/helpers";
import { getTask } from "@/shared/tasks";
import { formatClock, formatDateLabel } from "@/shared/utils/time";

type ExportValue = string | number;
type ExportRow = Record<string, ExportValue>;

function ticketFor(tickets: Ticket[], id: string | null): Ticket | null {
  return id ? tickets.find((ticket) => ticket.id === id) ?? null : null;
}

function entryToken(entry: SessionEntry): string {
  const ts = formatClock(entry.elapsedMs / 1000);
  return entry.kind === "anomaly"
    ? `EVENT:${entry.anomaly.toUpperCase()}@${ts}`
    : `${entry.verdict.toUpperCase()}@${ts}`;
}

function eventString(events: Record<string, number>): string {
  return Object.entries(events)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${id}:${count}`)
    .join("|");
}

export function buildExportRows(
  sessions: EvalSession[],
  tickets: Ticket[],
): ExportRow[] {
  return sessions.map((session) => {
    const ticket = ticketFor(tickets, session.ticketId);
    const base: ExportRow = {
      session_id: session.id,
      task: session.taskId,
      status: sessionStatusGroup(session).toUpperCase(),
      title: session.title || "",
      display_label: session.title || formatDateLabel(session.startedAt),
      model: session.model || "",
      ticket: ticket ? ticket.name : "",
      ticket_operators: ticket ? ticket.operators.join(", ") : "",
      comment: session.comment || "",
      started_at: session.startedAt || "",
    };
    const entries = sessionEntries(session);

    // Lego measures cost-to-completion (speed / attempts / rollouts), not a
    // success rate or color — so it exports a different column set.
    if (getTask(session.taskId).kind === "multi-rollout") {
      const m = getLegoMetrics(session);
      const timeSec = Math.round(m.totalTimeMs / 1000);
      return {
        ...base,
        time_seconds: timeSec,
        time_display: formatClock(timeSec),
        placed: m.placed,
        failed_attempts: m.failed,
        total_attempts: m.attempts,
        attempts_per_piece:
          m.attemptsPerPiece === null
            ? ""
            : Number(m.attemptsPerPiece.toFixed(3)),
        seconds_per_piece:
          m.secPerPiece === null ? "" : Number(m.secPerPiece.toFixed(2)),
        pieces_per_minute: Number(m.piecesPerMin.toFixed(3)),
        rollouts: m.rollouts,
        clean_rollouts: m.cleanRollouts,
        glitched_rollouts: m.glitchedRollouts,
        events: eventString(m.events),
        total_events: m.totalEvents,
        entries: entries.map(entryToken).join(" | "),
        entries_json: JSON.stringify(entries),
      };
    }

    const metrics = getSessionMetrics(session);
    const elapsedSec = Math.round(metrics.elapsedMs / 1000);
    return {
      ...base,
      color: session.color || "",
      target_duration_seconds: session.durationSec,
      duration_seconds: elapsedSec,
      duration_display: formatClock(elapsedSec),
      successes: metrics.successes,
      fails: metrics.fails,
      total: metrics.total,
      score_percent: metrics.score === null ? "" : metrics.score,
      quality_confidence_percent: metrics.total
        ? Number((metrics.qualityConfidence * 100).toFixed(2))
        : "",
      risk_confidence_percent: metrics.total
        ? Number((metrics.riskConfidence * 100).toFixed(2))
        : "",
      wilson_lower_percent: metrics.total
        ? Number((metrics.wilsonLower * 100).toFixed(2))
        : "",
      rate_per_minute: Number(metrics.ratePerMinute.toFixed(4)),
      events: eventString(metrics.events),
      total_events: Object.values(metrics.events).reduce(
        (sum, count) => sum + count,
        0,
      ),
      entries: entries.map(entryToken).join(" | "),
      entries_json: JSON.stringify(entries),
      // Per-attempt records: the grid placement each verdict happened at, with
      // its events grouped in (see getAttempts).
      attempts_json: JSON.stringify(getAttempts(session)),
    };
  });
}

function escapeCsv(value: ExportValue): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(sessions: EvalSession[], tickets: Ticket[]) {
  const rows = buildExportRows(sessions, tickets);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(
      rows.map((row) =>
        headers.map((header) => escapeCsv(row[header])).join(","),
      ),
    )
    .join("\n");
  downloadFile(csv, "evals_export.csv", "text/csv;charset=utf-8;");
}

export function exportJson(sessions: EvalSession[], tickets: Ticket[]) {
  const rows = buildExportRows(sessions, tickets);
  if (!rows.length) return;
  downloadFile(
    JSON.stringify(rows, null, 2),
    "evals_export.json",
    "application/json;charset=utf-8;",
  );
}
