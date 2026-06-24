import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import styles from "./TransportControls.module.css";

type TransportControlsProps = {
  newActive: boolean;
  onToggleNew: () => void;
};

export function TransportControls({
  newActive,
  onToggleNew,
}: TransportControlsProps) {
  const current = useEvalStore(selectCurrentSession);
  const start = useEvalStore((state) => state.startCurrentSession);
  const pause = useEvalStore((state) => state.pauseCurrentSession);
  const finish = useEvalStore((state) => state.finishCurrentSession);
  const stop = useEvalStore((state) => state.stopCurrentSession);
  const openModal = useEvalStore((state) => state.openModal);

  const hasSession = !!current;

  const isActive = current?.status === "active";
  const isPaused = current?.status === "paused";
  const isOngoing = isActive || isPaused;
  const isInitial = current?.status === "initial";
  const isDone = current?.status === "done";
  const isStopped = current?.status === "stopped";
  const hasModel = !!current?.model.trim();
  const canStart = hasSession && hasModel && !isActive && !isDone && !isStopped;
  const canPause = hasSession && isActive;
  const canFinishOrStop = hasSession && isOngoing;
  const canRestart = hasSession && !isInitial;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={`${styles.btn} ${isActive ? styles.active : ""}`}
        disabled={!canStart}
        onClick={start}
        title={hasSession && !hasModel ? "Set a model before starting" : undefined}
      >
        {hasSession && !hasModel ? "SET MODEL TO PLAY" : "▶ PLAY"}
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={!canPause}
        onClick={pause}
      >
        ⏸ PAUSE
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.successBtn}`}
        disabled={!canFinishOrStop}
        onClick={finish}
      >
        ✓ FINISH
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.dangerBtn}`}
        disabled={!canFinishOrStop}
        onClick={stop}
      >
        ■ STOP
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.dangerBtn}`}
        disabled={!canRestart}
        onClick={() => openModal("restart")}
      >
        ↻ RESTART
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.newBtn} ${newActive ? styles.active : ""}`}
        onClick={onToggleNew}
      >
        + NEW SESSION
      </button>
    </div>
  );
}
