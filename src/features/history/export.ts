import type { EvalSession, SessionEntry, Ticket } from "@/shared/types";
import { EVENT_TYPES } from "@/shared/constants";
import { getSessionMetrics, sessionStatusGroup } from "@/store/selectors";
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

export function buildExportRows(
  sessions: EvalSession[],
  tickets: Ticket[],
): ExportRow[] {
  return sessions.map((session) => {
    const metrics = getSessionMetrics(session);
    const ticket = ticketFor(tickets, session.ticketId);
    const elapsedSec = Math.round(metrics.elapsedMs / 1000);
    return {
      session_id: session.id,
      status: sessionStatusGroup(session).toUpperCase(),
      title: session.title || "",
      display_label: session.title || formatDateLabel(session.startedAt),
      model: session.model || "",
      color: session.color || "",
      ticket: ticket ? ticket.name : "",
      ticket_operators: ticket ? ticket.operators.join(", ") : "",
      comment: session.comment || "",
      started_at: session.startedAt || "",
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
      events: EVENT_TYPES.filter((type) => metrics.events[type.id])
        .map((type) => `${type.id}:${metrics.events[type.id]}`)
        .join("|"),
      total_events: Object.values(metrics.events).reduce(
        (sum, count) => sum + count,
        0,
      ),
      entries: session.entries.map(entryToken).join(" | "),
      entries_json: JSON.stringify(session.entries),
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
