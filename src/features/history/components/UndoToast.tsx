import { useEvalStore } from "@/store/evalStore";
import styles from "./UndoToast.module.css";

/**
 * Undo toast for deletion / erase. `recentlyRemoved` is armed by
 * `deleteSessions` and `eraseCurrentSession`; the drain bar runs for the undo
 * window via CSS and auto-dismisses on animation end. Re-keyed per snapshot so
 * a new removal restarts the timer.
 */
export function UndoToast() {
  const removed = useEvalStore((state) => state.recentlyRemoved);
  const restoreRemoved = useEvalStore((state) => state.restoreRemoved);
  const dismissRemoved = useEvalStore((state) => state.dismissRemoved);

  if (!removed) return null;

  const count = removed.items.length;

  return (
    <div className={styles.toast} key={removed.at}>
      <div className={styles.copy}>
        <div className={styles.title}>Change saved</div>
        <div className={styles.body}>
          Removed {count} session{count === 1 ? "" : "s"}. Undo available for a
          few seconds.
        </div>
      </div>
      <div className={styles.side}>
        <div className={styles.timer}>
          <div className={styles.fill} onAnimationEnd={dismissRemoved} />
        </div>
        <button
          type="button"
          className={styles.undoBtn}
          onClick={restoreRemoved}
        >
          Undo
        </button>
      </div>
    </div>
  );
}
