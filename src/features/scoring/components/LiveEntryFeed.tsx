import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { currentRollout } from "@/store/helpers";
import { getTask } from "@/shared/tasks";
import type { SessionEntry } from "@/shared/types";
import { formatClock } from "@/shared/utils/time";
import styles from "./LiveEntryFeed.module.css";

type EventEntry = Extract<SessionEntry, { kind: "anomaly" }>;

/**
 * The current rollout's logged EVENTS (not verdicts), newest first, each
 * deletable — so an operator can fix a mis-logged or misheard event mid-
 * rollout. The same per-entry delete exists in history for after the fact.
 */
export function LiveEntryFeed() {
  const current = useEvalStore(selectCurrentSession);
  const deleteEntry = useEvalStore((state) => state.deleteEntry);

  if (!current) return null;
  const task = getTask(current.taskId);
  const rollout = currentRollout(current);
  const visibleEventIds = new Set(
    task.events.filter((event) => !event.primary).map((event) => event.id),
  );
  const events = rollout.entries.filter(
    (entry): entry is EventEntry =>
      entry.kind === "anomaly" && visibleEventIds.has(entry.anomaly),
  );
  if (!events.length) return null;

  const labelOf = (entry: EventEntry) =>
    task.events.find((event) => event.id === entry.anomaly)?.label ??
    entry.anomaly;
  const isPositive = (entry: EventEntry) =>
    task.events.find((event) => event.id === entry.anomaly)?.valence ===
    "positive";
  const eventClass = (entry: EventEntry) => {
    switch (entry.anomaly) {
      case "collision":
        return styles.collision;
      case "dropped":
        return styles.dropped;
      case "phantom":
        return styles.phantom;
      case "shaky":
        return styles.shaky;
      case "random":
        return styles.random;
      case "spill":
        return styles.spill;
      case "ignored_outside":
        return styles.ignoredOutside;
      case "miss":
        return styles.miss;
      case "multi_grab":
        return styles.multiGrab;
      case "glitch":
        return styles.glitch;
      case "good_recovery":
        return styles.goodRecovery;
      default:
        return "";
    }
  };

  const undoLast = () => {
    const last = events[events.length - 1];
    if (last) deleteEntry(current.id, last.id);
  };

  return (
    <div className={styles.feed}>
      <div className={styles.head}>
        <span className={styles.label}>EVENTS · {events.length}</span>
        <button type="button" className={styles.undoBtn} onClick={undoLast}>
          ↶ UNDO LAST
        </button>
      </div>
      <div className={styles.chips}>
        {[...events].reverse().map((entry) => (
          <span
            key={entry.id}
            className={`${styles.chip} ${
              isPositive(entry) ? styles.positive : styles.event
            } ${eventClass(entry)}`}
          >
            <span className={styles.chipText}>{labelOf(entry)}</span>
            <span className={styles.chipTime}>
              {formatClock(entry.elapsedMs / 1000)}
            </span>
            <button
              type="button"
              className={styles.del}
              title="Delete event"
              aria-label="Delete event"
              onClick={() => deleteEntry(current.id, entry.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
