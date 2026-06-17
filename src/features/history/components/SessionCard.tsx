import { useState } from "react";
import type { EvalSession, SessionEntry } from "@/shared/types";
import { COMMENT_MAX, EVENT_TYPES } from "@/shared/constants";
import { useEvalStore } from "@/store/evalStore";
import { getSessionMetrics, sessionStatusGroup } from "@/store/selectors";
import { formatClock, formatDateLabel } from "@/shared/utils/time";
import styles from "./SessionCard.module.css";

const STATUS_LABEL = {
  active: "ACTIVE",
  done: "DONE",
  stopped: "STOPPED",
} as const;

function scoreClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 70) return styles.scoreGood;
  if (score >= 40) return styles.scoreMid;
  return styles.scoreBad;
}

function EntryList({ session }: { session: EvalSession }) {
  // Number verdict entries (skipping anomalies) before render.
  const rows: { entry: SessionEntry; verdictNumber: number | null }[] = [];
  let verdictCount = 0;
  for (const entry of session.entries) {
    if (entry.kind === "verdict") {
      verdictCount += 1;
      rows.push({ entry, verdictNumber: verdictCount });
    } else {
      rows.push({ entry, verdictNumber: null });
    }
  }

  return (
    <>
      {rows.map(({ entry, verdictNumber }) => {
        const ts = formatClock(entry.elapsedMs / 1000);
        if (entry.kind === "anomaly") {
          const meta = EVENT_TYPES.find((type) => type.id === entry.anomaly);
          return (
            <div
              key={entry.id}
              className={`${styles.entryRow} ${styles.ev} ${styles[entry.anomaly]}`}
            >
              <span className={styles.entryBadge}>
                {meta?.label ?? entry.anomaly}
              </span>
              <span className={styles.entryTs}>@ {ts}</span>
              <span className={styles.entryKind}>EVENT</span>
            </div>
          );
        }
        return (
          <div
            key={entry.id}
            className={`${styles.entryRow} ${entry.verdict === "success" ? styles.s : styles.f}`}
          >
            <span className={styles.entryBadge}>
              {entry.verdict === "success" ? "PASS" : "FAIL"}
            </span>
            <span className={styles.entryTs}>@ {ts}</span>
            <span className={styles.entryKind}>#{verdictNumber}</span>
          </div>
        );
      })}
    </>
  );
}

export function SessionCard({ session }: { session: EvalSession }) {
  const [expanded, setExpanded] = useState(false);
  const currentSessionId = useEvalStore((state) => state.currentSessionId);
  const tickets = useEvalStore((state) => state.tickets);
  const selectMode = useEvalStore((state) => state.selectMode);
  const selectedSessionIds = useEvalStore((state) => state.selectedSessionIds);
  const historySort = useEvalStore((state) => state.historySort);
  const resumeSession = useEvalStore((state) => state.resumeSession);
  const deleteSessions = useEvalStore((state) => state.deleteSessions);
  const openModal = useEvalStore((state) => state.openModal);
  const assignSessionsToTicket = useEvalStore(
    (state) => state.assignSessionsToTicket,
  );
  const setSessionComment = useEvalStore((state) => state.setSessionComment);
  const toggleSessionSelected = useEvalStore(
    (state) => state.toggleSessionSelected,
  );

  const group = sessionStatusGroup(session);
  const metrics = getSessionMetrics(session);
  const isLiveCurrent = session.id === currentSessionId && group === "active";
  const ticket = tickets.find((item) => item.id === session.ticketId) ?? null;
  const selected = selectedSessionIds.includes(session.id);
  const label = session.title || formatDateLabel(session.startedAt);
  const cardClass =
    group === "active"
      ? styles.activeCard
      : group === "done"
        ? styles.completed
        : styles.incomplete;

  const rank = metrics.total
    ? historySort === "worst"
      ? `RISK ${(metrics.riskConfidence * 100).toFixed(1)}%`
      : `QUALITY ${(metrics.qualityConfidence * 100).toFixed(1)}%`
    : historySort === "worst"
      ? "RISK —"
      : "QUALITY —";

  const presentEvents = EVENT_TYPES.filter((type) => metrics.events[type.id] > 0);
  const compactEvents = presentEvents.length > 2;

  return (
    <div
      className={`${styles.card} ${cardClass} ${expanded ? styles.expanded : ""} ${
        selectMode ? styles.selectMode : ""
      }`}
    >
      <div className={styles.head} onClick={() => setExpanded((open) => !open)}>
        {selectMode && (
          <label
            className={styles.selectWrap}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              className={styles.select}
              checked={selected}
              onChange={() => toggleSessionSelected(session.id)}
            />
          </label>
        )}
        <div className={styles.statusDot} />

        <div className={styles.metaInner}>
          <span className={styles.num}>
            {STATUS_LABEL[group]} ·{" "}
            <span className={styles.primaryLabel}>{label}</span>
          </span>
          {session.model && (
            <span className={styles.modelTag}>{session.model}</span>
          )}
          {session.color && (
            <span className={`${styles.colorTag} ${styles[session.color]}`}>
              ● {session.color.toUpperCase()}
            </span>
          )}
          {presentEvents.length > 0 && (
            <span className={styles.eventTags}>
              {presentEvents.map((type) => (
                <span
                  key={type.id}
                  className={`${styles.eventDot} ${styles[type.id]}`}
                  title={`${type.label} × ${metrics.events[type.id]}`}
                >
                  {compactEvents
                    ? `●${metrics.events[type.id]}`
                    : `${type.label} ×${metrics.events[type.id]}`}
                </span>
              ))}
            </span>
          )}
          {ticket && (
            <span
              className={styles.ticketTag}
              title={
                ticket.operators.length
                  ? `OPERATORS: ${ticket.operators.join(", ")}`
                  : "NO OPERATORS"
              }
            >
              {ticket.name}
            </span>
          )}
          {session.comment && <span className={styles.commentTag}>COMMENT</span>}
          <span className={styles.timeTag}>
            {formatClock(metrics.elapsedMs / 1000)}
          </span>
          <span className={styles.rankTag}>{rank}</span>
          <div className={styles.quickStats}>
            <span className={styles.qsS}>✓ {metrics.successes}</span>
            <span className={styles.qsF}>✕ {metrics.fails}</span>
            <span className={`${styles.scoreTag} ${scoreClass(metrics.score)}`}>
              {metrics.score === null ? "—" : `${metrics.score}%`}
            </span>
          </div>
        </div>

        <select
          className={styles.inlineTicket}
          value={session.ticketId ?? ""}
          title="Assign ticket"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            assignSessionsToTicket([session.id], event.target.value || null);
          }}
        >
          <option value="">NO TICKET</option>
          {tickets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        {!isLiveCurrent && (
          <button
            type="button"
            className={styles.actionBtn}
            title="Rename session"
            onClick={(event) => {
              event.stopPropagation();
              openModal("renameSession", session.id);
            }}
          >
            Rename
          </button>
        )}
        {!isLiveCurrent && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.danger}`}
            title="Delete session"
            onClick={(event) => {
              event.stopPropagation();
              deleteSessions([session.id]);
            }}
          >
            Delete
          </button>
        )}
        <span className={styles.collapseIcon}>▼</span>
      </div>

      {expanded && (
        <div className={styles.entries}>
          <div className={styles.entriesSummary}>
            <span className={styles.chip}>
              QUALITY {(metrics.qualityConfidence * 100).toFixed(1)}%
            </span>
            <span className={styles.chip}>
              RISK {(metrics.riskConfidence * 100).toFixed(1)}%
            </span>
            <span className={styles.chip}>
              RAW {metrics.score === null ? "—" : `${metrics.score}%`}
            </span>
            <span className={styles.chip}>
              RATE {metrics.ratePerMinute.toFixed(2)}/MIN
            </span>
            <span className={styles.chip}>
              DURATION {formatClock(metrics.elapsedMs / 1000)}
            </span>
            <span className={styles.chip}>TOTAL {metrics.total}</span>
            {ticket && ticket.operators.length > 0 && (
              <span className={styles.chip}>
                OPERATORS: {ticket.operators.join(", ")}
              </span>
            )}
          </div>

          <div className={styles.commentWrap}>
            <div className={styles.commentLabel}>Comment (optional)</div>
            <textarea
              className={styles.commentInput}
              maxLength={COMMENT_MAX}
              placeholder="Add a short note for this session..."
              defaultValue={session.comment}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) =>
                setSessionComment(session.id, event.target.value)
              }
            />
            <div className={styles.commentMeta}>
              {session.comment.length}/{COMMENT_MAX}
            </div>
          </div>

          {session.entries.length === 0 ? (
            <div className={styles.noEntries}>No entries yet.</div>
          ) : (
            <EntryList session={session} />
          )}

          {group === "stopped" && (
            <button
              type="button"
              className={styles.resumeBtn}
              onClick={(event) => {
                event.stopPropagation();
                resumeSession(session.id);
              }}
            >
              ▶ RESUME SESSION
            </button>
          )}
        </div>
      )}
    </div>
  );
}
