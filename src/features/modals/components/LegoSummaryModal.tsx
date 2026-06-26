import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Dialog } from "radix-ui";
import type { SummaryView } from "@/shared/types";
import { useEvalStore } from "@/store/evalStore";
import { getTask } from "@/shared/tasks";
import { selectFilteredSessions, selectTickets } from "@/store/selectors";
import {
  buildLegoModelReportClipboard,
  buildLegoModelRows,
  buildLegoRows,
  type LegoModelRow,
  type LegoReportFormat,
  type LegoSummarySortDirection,
  pickEfficientLego,
  pickFastestLego,
  type LegoRow,
} from "@/features/history/summary";
import { EventHoverPopover } from "./EventHoverPopover";
import styles from "./SelectionSummaryModal.module.css";

const VIEWS: { id: SummaryView; label: string }[] = [
  { id: "list", label: "LIST" },
  { id: "chart", label: "CHART" },
  { id: "models", label: "BY MODEL" },
];

type LegoChartMetric = "speed" | "efficiency" | "throughput" | "rollouts";

const CHART_METRICS: { id: LegoChartMetric; label: string }[] = [
  { id: "speed", label: "SEC / PIECE" },
  { id: "efficiency", label: "ATT / PIECE" },
  { id: "throughput", label: "PIECES / MIN" },
  { id: "rollouts", label: "ROLLOUTS" },
];

const SORT_OPTIONS: { id: LegoSummarySortDirection; label: string }[] = [
  { id: "best", label: "BEST -> WORST" },
  { id: "worst", label: "WORST -> BEST" },
];

const COPY_OPTIONS: { id: LegoReportFormat; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "detailed", label: "Detailed" },
  { id: "slack", label: "For Slack" },
];

const fmtSec = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}s`;
const fmtAtt = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

const LEGO_EVENT_LABELS = Object.fromEntries(
  getTask("lego-transfer").events.map((event) => [event.id, event.label]),
) as Record<string, string>;

function eventRows(events: Record<string, number>) {
  return Object.entries(events)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ id, label: LEGO_EVENT_LABELS[id] ?? id, count }));
}

function eventSwatchClass(id: string): string {
  if (id === "spill") return styles.evSpill;
  if (id === "ignored_outside") return styles.evIgnoredOutside;
  if (id === "dropped") return styles.evDropped;
  if (id === "miss") return styles.evMiss;
  if (id === "multi_grab") return styles.evMultiGrab;
  if (id === "glitch") return styles.evGlitch;
  if (id === "good_recovery") return styles.evGoodRecovery;
  if (id === "bad_grasp") return styles.evBadGrasp;
  return styles.evDefault;
}

function LegoEventHover({
  total,
  events,
}: {
  total: number;
  events: Record<string, number>;
}) {
  return (
    <EventHoverPopover
      total={total}
      rows={eventRows(events).map((event) => ({
        ...event,
        dotClassName: eventSwatchClass(event.id),
      }))}
    />
  );
}

function sortArrowLabel(direction: LegoSummarySortDirection): string {
  return direction === "best" ? "BEST -> WORST" : "WORST -> BEST";
}

function sortRowsByModelOrder(
  rows: LegoRow[],
  modelRows: LegoModelRow[],
): LegoRow[] {
  const rank = new Map(
    modelRows.map((row, index) => [row.model.trim().toUpperCase(), index]),
  );
  return [...rows].sort((a, b) => {
    const modelA = (a.model.trim() || "NO MODEL").toUpperCase();
    const modelB = (b.model.trim() || "NO MODEL").toUpperCase();
    const rankA = rank.get(modelA) ?? Number.MAX_SAFE_INTEGER;
    const rankB = rank.get(modelB) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.session.startedAt.localeCompare(b.session.startedAt);
  });
}

function chartValue(row: LegoRow, metric: LegoChartMetric): number {
  if (metric === "speed") return row.metrics.secPerPiece ?? 0;
  if (metric === "efficiency") return row.metrics.attemptsPerPiece ?? 0;
  if (metric === "throughput") return row.metrics.piecesPerMin;
  return row.metrics.rollouts;
}

function chartFormat(row: LegoRow, metric: LegoChartMetric): string {
  if (metric === "speed") return fmtSec(row.metrics.secPerPiece);
  if (metric === "efficiency") return fmtAtt(row.metrics.attemptsPerPiece);
  if (metric === "throughput")
    return `${row.metrics.piecesPerMin.toFixed(1)}/m`;
  return `${row.metrics.rollouts}`;
}

function chartValueClass(metric: LegoChartMetric): string {
  if (metric === "speed") return styles.numAccent;
  if (metric === "efficiency") return styles.numWarn;
  if (metric === "throughput") return styles.numSuccess;
  return styles.numStrong;
}

export function LegoSummaryModal({ open }: { open: boolean }) {
  const closeModal = useEvalStore((state) => state.closeModal);
  const rawView = useEvalStore((state) => state.summaryView);
  const setSummaryView = useEvalStore((state) => state.setSummaryView);
  const sessions = useEvalStore((state) => state.sessions);
  const tickets = useEvalStore(useShallow(selectTickets));
  const selectedIds = useEvalStore((state) => state.selectedSessionIds);
  const [metric, setMetric] = useState<LegoChartMetric>("speed");
  const [sortDirection, setSortDirection] =
    useState<LegoSummarySortDirection>("best");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [copyOpen, setCopyOpen] = useState(false);
  const view = VIEWS.some((entry) => entry.id === rawView) ? rawView : "list";

  const targets = selectedIds.length
    ? sessions.filter((session) => selectedIds.includes(session.id))
    : selectFilteredSessions(useEvalStore.getState());
  const rows = buildLegoRows(targets, sortDirection);
  const modelRows = buildLegoModelRows(rows, sortDirection);
  const fastest = pickFastestLego(rows);
  const efficient = pickEfficientLego(rows);
  const scope = selectedIds.length
    ? `${rows.length} SELECTED`
    : `ALL VISIBLE (${rows.length})`;
  const maxChart = Math.max(1, ...rows.map((row) => chartValue(row, metric)));

  const operatorsForSession = (sessionId: string) => {
    const ticketId = sessions.find(
      (session) => session.id === sessionId,
    )?.ticketId;
    if (!ticketId) return [] as string[];
    return tickets.find((ticket) => ticket.id === ticketId)?.operators ?? [];
  };

  const operatorsByModel = sortRowsByModelOrder(rows, modelRows).reduce<
    Record<string, string[]>
  >((acc, row) => {
    const model = row.model.trim() || "NO MODEL";
    const operators = operatorsForSession(row.session.id);
    if (!operators.length) {
      if (!acc[model]) acc[model] = [];
      return acc;
    }
    const prev = new Set(acc[model] ?? []);
    operators.forEach((name) => prev.add(name));
    acc[model] = [...prev].sort((a, b) => a.localeCompare(b));
    return acc;
  }, {});

  const commentsByModel = sortRowsByModelOrder(rows, modelRows).reduce<
    Record<string, string[]>
  >((acc, row) => {
    const model = row.model.trim() || "NO MODEL";
    const comment = row.session.comment.replace(/\s+/g, " ").trim();
    if (!acc[model]) acc[model] = [];
    if (comment && !acc[model].includes(comment)) acc[model].push(comment);
    return acc;
  }, {});

  const writeClipboard = async (text: string) => {
    if (!text) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // clipboard API blocked — fall back to execCommand below
    }
    if (!ok) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        // copy command unavailable
      }
      area.remove();
    }
    setCopyLabel(ok ? "Copied" : "Failed");
    setTimeout(() => setCopyLabel("Copy"), 1400);
  };

  const copyReport = async (format: LegoReportFormat) => {
    const text = buildLegoModelReportClipboard(modelRows, format, {
      commentsByModel,
      operatorsByModel,
    });
    await writeClipboard(text);
    setCopyOpen(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.modal} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>
            Summary · Lego Transfer
          </Dialog.Title>

          <div className={styles.toolbar}>
            <span className={styles.subtitle}>{scope}</span>
            <div className={styles.toolbarControls}>
              {view === "chart" && (
                <select
                  className={styles.metricSelect}
                  value={metric}
                  onChange={(event) =>
                    setMetric(event.target.value as LegoChartMetric)
                  }
                >
                  {CHART_METRICS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              )}
              <select
                className={styles.metricSelect}
                value={sortDirection}
                onChange={(event) =>
                  setSortDirection(
                    event.target.value as LegoSummarySortDirection,
                  )
                }
                title="Sort summary"
              >
                {SORT_OPTIONS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <div className={styles.viewSwitch}>
                {VIEWS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`${styles.switchBtn} ${view === entry.id ? styles.active : ""}`}
                    onClick={() => setSummaryView(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>FASTEST</div>
              <div className={styles.metricValue}>
                {fastest ? fastest.model || "NO MODEL" : "NO DATA"}
              </div>
              <div className={styles.metricMeta}>
                {fastest ? (
                  <span className={styles.metricMetaLine}>
                    <span className={styles.numAccent}>
                      {fmtSec(fastest.metrics.secPerPiece)}/PIECE
                    </span>
                    <span>·</span>
                    <span className={styles.numSuccess}>
                      {fastest.metrics.placed} PLACED
                    </span>
                    <span>·</span>
                    <span>{sortArrowLabel(sortDirection)}</span>
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>MOST EFFICIENT</div>
              <div className={styles.metricValue}>
                {efficient ? efficient.model || "NO MODEL" : "NO DATA"}
              </div>
              <div className={styles.metricMeta}>
                {efficient ? (
                  <span className={styles.metricMetaLine}>
                    <span className={styles.numWarn}>
                      {fmtAtt(efficient.metrics.attemptsPerPiece)} ATT/PIECE
                    </span>
                    <span>·</span>
                    <span className={styles.numWarn}>
                      {efficient.metrics.badGrasps} BAD GRASP
                    </span>
                    <span>·</span>
                    <span className={styles.numFail}>
                      {efficient.metrics.glitchedRollouts} GLITCHED
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className={styles.empty}>
              SELECT SESSIONS TO GENERATE A SUMMARY
            </div>
          ) : view === "chart" ? (
            <div className={styles.graphWrap}>
              <div className={styles.graphList}>
                {rows.map((row, index) => {
                  const value = chartValue(row, metric);
                  const width = Math.max(
                    0,
                    Math.min(100, (value / maxChart) * 100),
                  );
                  return (
                    <div key={row.session.id} className={styles.graphRow}>
                      <div className={styles.graphLabel}>
                        #{index + 1} {row.model || "NO MODEL"}
                      </div>
                      <div className={styles.graphTrack}>
                        <div
                          className={styles.graphFill}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div
                        className={`${styles.graphValue} ${chartValueClass(metric)}`}
                      >
                        {chartFormat(row, metric)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : view === "models" ? (
            <div className={styles.listWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Model</th>
                    <th>Sec/Pc</th>
                    <th>Att/Pc</th>
                    <th>Placed</th>
                    <th>Failed</th>
                    <th>Bad Grasp</th>
                    <th>Rollouts</th>
                    <th>Glitched</th>
                    <th>Events</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((row, index) => (
                    <tr key={row.model}>
                      <td>
                        <span className={styles.rank}>{index + 1}</span>
                      </td>
                      <td className={styles.modelCell}>{row.model}</td>
                      <td className={styles.numAccent}>
                        {fmtSec(row.secPerPiece)}
                      </td>
                      <td className={styles.numWarn}>
                        {fmtAtt(row.attemptsPerPiece)}
                      </td>
                      <td className={styles.numSuccess}>{row.placed}</td>
                      <td className={styles.numFail}>{row.failed}</td>
                      <td className={styles.numWarn}>{row.badGrasps}</td>
                      <td className={styles.numStrong}>{row.rollouts}</td>
                      <td className={styles.numFail}>
                        {row.glitchedRollouts}
                      </td>
                      <td>
                        <LegoEventHover
                          total={row.totalEvents}
                          events={row.events}
                        />
                      </td>
                      <td className={styles.numAccent}>{row.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.listWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Model</th>
                    <th>Placed</th>
                    <th>Failed</th>
                    <th>Att/Pc</th>
                    <th>Sec/Pc</th>
                    <th>Bad Grasp</th>
                    <th>Rollouts</th>
                    <th>Glitched</th>
                    <th>Events</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.session.id}>
                      <td>
                        <span className={styles.rank}>{index + 1}</span>
                      </td>
                      <td className={styles.modelCell}>
                        {row.model || "NO MODEL"}
                      </td>
                      <td className={styles.numSuccess}>
                        {row.metrics.placed}
                      </td>
                      <td className={styles.numFail}>{row.metrics.failed}</td>
                      <td className={styles.numWarn}>
                        {fmtAtt(row.metrics.attemptsPerPiece)}
                      </td>
                      <td className={styles.numAccent}>
                        {fmtSec(row.metrics.secPerPiece)}
                      </td>
                      <td className={styles.numWarn}>
                        {row.metrics.badGrasps}
                      </td>
                      <td className={styles.numStrong}>
                        {row.metrics.rollouts}
                      </td>
                      <td className={styles.numFail}>
                        {row.metrics.glitchedRollouts}
                      </td>
                      <td>
                        <LegoEventHover
                          total={row.metrics.totalEvents}
                          events={row.metrics.events}
                        />
                      </td>
                      <td className={styles.commentCell}>
                        {row.session.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.footer}>
            <span className={styles.copyNote}>
              Copy model reports as brief, detailed, or Slack-ready text.
            </span>
            <div className={styles.btns}>
              <Dialog.Close asChild>
                <button type="button" className={styles.btn}>
                  Close
                </button>
              </Dialog.Close>
              <div className={styles.copyMenu}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.primary}`}
                  aria-expanded={copyOpen}
                  onClick={() => setCopyOpen((next) => !next)}
                >
                  <span>{copyLabel}</span>
                  <span
                    className={`${styles.copyChevron} ${
                      copyOpen ? styles.copyChevronOpen : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {copyOpen && (
                  <div className={styles.copyOptions}>
                    {COPY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={styles.copyOption}
                        onClick={() => void copyReport(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
