import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { currentRollout, elapsedOf } from "@/store/helpers";
import { formatClock } from "@/shared/utils/time";
import { useElapsedTick } from "../hooks/useElapsedTick";
import { DurationControls } from "./DurationControls";
import { SessionMeta } from "./SessionMeta";
import styles from "./StopwatchBlock.module.css";

export function StopwatchBlock() {
  useElapsedTick();
  const current = useEvalStore(selectCurrentSession);
  const defaultDurationSec = useEvalStore((state) => state.defaultDurationSec);

  const durationSec = current ? current.durationSec : defaultDurationSec;
  const unlimited = durationSec === 0;
  const elapsedSec = current
    ? Math.floor(elapsedOf(currentRollout(current)) / 1000)
    : 0;
  const remaining = unlimited ? 0 : Math.max(0, durationSec - elapsedSec);

  const display = unlimited ? formatClock(elapsedSec) : formatClock(remaining);
  const progressPct = unlimited
    ? current
      ? 100
      : 0
    : Math.min((elapsedSec / durationSec) * 100, 100);

  let level: "" | "warn" | "danger" = "";
  if (!unlimited) {
    if (remaining <= 30 && remaining > 0) level = "danger";
    else if (remaining <= Math.min(60, Math.floor(durationSec * 0.2)))
      level = "warn";
  }

  const durationLabel = unlimited ? "UNLIMITED" : formatClock(durationSec);
  const color = current?.color ?? null;

  const timerLevel =
    level === "danger"
      ? styles.timerDanger
      : level === "warn"
        ? styles.timerWarn
        : "";
  const barLevel =
    level === "danger"
      ? styles.barDanger
      : level === "warn"
        ? styles.barWarn
        : "";

  return (
    <div className={styles.stopwatchBlock}>
      <div className={styles.label}>
        SESSION TIMER · {durationLabel}
        {color && (
          <>
            {" · "}
            <span className={`${styles.colorTag} ${styles[color]}`}>
              ● {color.toUpperCase()}
            </span>
          </>
        )}
      </div>
      <div className={`${styles.timer} ${timerLevel}`}>{display}</div>
      <div className={styles.progressWrap}>
        <div
          className={`${styles.progress} ${barLevel}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <DurationControls />
      <SessionMeta />
    </div>
  );
}
