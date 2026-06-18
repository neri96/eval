import { useEffect, useRef, useState } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession, getSessionStats } from "@/store/selectors";
import styles from "./EvalArea.module.css";

const EMPTY_STATS = {
  successes: 0,
  fails: 0,
  total: 0,
  score: null as number | null,
};

export function EvalArea() {
  const current = useEvalStore(selectCurrentSession);
  const addSuccess = useEvalStore((state) => state.addSuccess);
  const addFail = useEvalStore((state) => state.addFail);

  const isActive = current?.status === "active";
  const stats = current ? getSessionStats(current) : EMPTY_STATS;

  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const prev = useRef({ successes: 0, fails: 0 });

  useEffect(() => {
    if (stats.successes > prev.current.successes) setFlash("success");
    else if (stats.fails > prev.current.fails) setFlash("fail");
    prev.current = { successes: stats.successes, fails: stats.fails };
  }, [stats.successes, stats.fails]);

  return (
    <>
      <div className={styles.evalArea}>
        <button
          type="button"
          className={`${styles.verdict} ${styles.fail} ${
            flash === "fail" ? styles.flashFail : ""
          }`}
          disabled={!isActive}
          onClick={addFail}
          onAnimationEnd={() => setFlash(null)}
        >
          ✕ FAIL
          <span className={styles.keyHint}>← LEFT ARROW</span>
        </button>

        <div className={styles.stats}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>SUCCESS</span>
            <span className={`${styles.statValue} ${styles.successVal}`}>
              {stats.successes}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>FAILS</span>
            <span className={`${styles.statValue} ${styles.failVal}`}>
              {stats.fails}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>TOTAL</span>
            <span className={`${styles.statValue} ${styles.totalVal}`}>
              {stats.total}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>SCORE</span>
            <span className={`${styles.statValue} ${styles.scoreVal}`}>
              {stats.score === null ? "—" : `${stats.score}%`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.verdict} ${styles.success} ${
            flash === "success" ? styles.flashSuccess : ""
          }`}
          disabled={!isActive}
          onClick={addSuccess}
          onAnimationEnd={() => setFlash(null)}
        >
          ✓ SUCCESS
          <span className={styles.keyHint}>→ RIGHT ARROW</span>
        </button>
      </div>

      <div className={styles.keyHints}>
        <div className={styles.keyHintItem}>
          <kbd>←</kbd> FAIL
        </div>
        <div className={styles.keyHintItem}>
          <kbd>→</kbd> SUCCESS
        </div>
      </div>
    </>
  );
}
