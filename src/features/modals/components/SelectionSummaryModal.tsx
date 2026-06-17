import { useState } from "react";
import { Dialog } from "radix-ui";
import type { SummaryGraphMetric, SummaryView } from "@/shared/types";
import { SESSION_COLORS } from "@/shared/constants";
import { useEvalStore } from "@/store/evalStore";
import { selectFilteredSessions } from "@/store/selectors";
import {
  buildModelClipboard,
  buildModelRows,
  buildSessionClipboard,
  buildSummaryRows,
  pickBest,
  pickFastest,
  type SummaryRow,
} from "@/features/history/summary";
import styles from "./SelectionSummaryModal.module.css";

const VIEWS: { id: SummaryView; label: string }[] = [
  { id: "list", label: "LIST" },
  { id: "chart", label: "CHART" },
  { id: "models", label: "BY MODEL" },
];

function scoreClass(score: number | null) {
  if (score === null) return "";
  if (score >= 70) return styles.scoreGood;
  if (score >= 40) return styles.scoreMid;
  return styles.scoreBad;
}

const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

function graphValue(row: SummaryRow, metric: SummaryGraphMetric): number {
  if (metric === "rate") return row.metrics.ratePerMinute;
  if (metric === "total") return row.metrics.total;
  return row.metrics.score ?? 0;
}
function graphFormat(row: SummaryRow, metric: SummaryGraphMetric): string {
  if (metric === "rate") return `${row.metrics.ratePerMinute.toFixed(2)}/MIN`;
  if (metric === "total") return `${row.metrics.total}`;
  return row.metrics.score === null ? "—" : `${row.metrics.score}%`;
}

export function SelectionSummaryModal({ open }: { open: boolean }) {
  const closeModal = useEvalStore((state) => state.closeModal);
  const view = useEvalStore((state) => state.summaryView);
  const graphMetric = useEvalStore((state) => state.summaryGraphMetric);
  const setSummaryView = useEvalStore((state) => state.setSummaryView);
  const setSummaryGraphMetric = useEvalStore(
    (state) => state.setSummaryGraphMetric,
  );
  const sessions = useEvalStore((state) => state.sessions);
  const selectedIds = useEvalStore((state) => state.selectedSessionIds);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const targets = selectedIds.length
    ? sessions.filter((session) => selectedIds.includes(session.id))
    : selectFilteredSessions(useEvalStore.getState());
  const rows = buildSummaryRows(targets);
  const modelRows = buildModelRows(rows);
  const best = pickBest(rows);
  const fastest = pickFastest(rows);
  const scope = selectedIds.length
    ? `${rows.length} SELECTED`
    : `ALL VISIBLE (${rows.length})`;
  const maxGraph = Math.max(1, ...rows.map((row) => graphValue(row, graphMetric)));

  const copy = async () => {
    const text =
      view === "models"
        ? buildModelClipboard(modelRows)
        : buildSessionClipboard(rows);
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
          <Dialog.Title className={styles.title}>Summary</Dialog.Title>

          <div className={styles.toolbar}>
            <span className={styles.subtitle}>{scope}</span>
            <div className={styles.toolbarControls}>
              {view === "chart" && (
                <select
                  className={styles.metricSelect}
                  value={graphMetric}
                  onChange={(event) =>
                    setSummaryGraphMetric(
                      event.target.value as SummaryGraphMetric,
                    )
                  }
                >
                  <option value="score">SCORE %</option>
                  <option value="rate">THROUGHPUT</option>
                  <option value="total">TOTAL EVALS</option>
                </select>
              )}
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
              <div className={styles.metricLabel}>BEST</div>
              <div className={styles.metricValue}>
                {best ? best.model || "NO MODEL" : "NO DATA"}
              </div>
              <div className={styles.metricMeta}>
                {best
                  ? `SCORE ${best.metrics.score === null ? "—" : `${best.metrics.score}%`} · TOTAL ${best.metrics.total}`
                  : "—"}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>FASTEST</div>
              <div className={styles.metricValue}>
                {fastest ? fastest.model || "NO MODEL" : "NO DATA"}
              </div>
              <div className={styles.metricMeta}>
                {fastest
                  ? `RATE ${fastest.metrics.ratePerMinute.toFixed(2)}/MIN · TOTAL ${fastest.metrics.total}`
                  : "—"}
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
                  const value = graphValue(row, graphMetric);
                  const width = Math.max(
                    0,
                    Math.min(100, (value / maxGraph) * 100),
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
                      <div className={styles.graphValue}>
                        {graphFormat(row, graphMetric)}
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
                    {SESSION_COLORS.map((color) => (
                      <th key={color}>{cap(color)}</th>
                    ))}
                    <th>Overall</th>
                    <th>Confidence</th>
                    <th>Sessions</th>
                    <th>Evals</th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((row, index) => {
                    const overall =
                      row.overallRaw === null ? null : Math.round(row.overallRaw);
                    return (
                      <tr key={row.model}>
                        <td>
                          <span className={styles.rank}>{index + 1}</span>
                        </td>
                        <td className={styles.modelCell}>{row.model}</td>
                        {SESSION_COLORS.map((color) => {
                          const avg = row.colors[color].avg;
                          return (
                            <td key={color}>
                              {avg === null ? (
                                "—"
                              ) : (
                                <span className={scoreClass(Math.round(avg))}>
                                  {Math.round(avg)}%
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className={scoreClass(overall)}>
                          {overall === null ? "—" : `${overall}%`}
                        </td>
                        <td>{row.overallConfidence.toFixed(1)}%</td>
                        <td>{row.sessions}</td>
                        <td>{row.totalEvals}</td>
                      </tr>
                    );
                  })}
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
                    <th>Color</th>
                    <th>Success</th>
                    <th>Fail</th>
                    <th>Total</th>
                    <th>Score</th>
                    <th>Rate</th>
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
                      <td>
                        {row.session.color
                          ? row.session.color.toUpperCase()
                          : "—"}
                      </td>
                      <td>{row.metrics.successes}</td>
                      <td>{row.metrics.fails}</td>
                      <td>{row.metrics.total}</td>
                      <td className={scoreClass(row.metrics.score)}>
                        {row.metrics.score === null
                          ? "—"
                          : `${row.metrics.score}%`}
                      </td>
                      <td>{row.metrics.ratePerMinute.toFixed(2)}/m</td>
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
              Copy follows the current view.
            </span>
            <div className={styles.btns}>
              <Dialog.Close asChild>
                <button type="button" className={styles.btn}>
                  Close
                </button>
              </Dialog.Close>
              <button
                type="button"
                className={`${styles.btn} ${styles.primary}`}
                onClick={copy}
              >
                {copyLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
