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

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={`${styles.btn} ${isActive ? styles.active : ""}`}
        disabled={!hasSession || isActive}
        onClick={start}
      >
        ▶ PLAY
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={!isActive}
        onClick={pause}
      >
        ⏸ PAUSE
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.successBtn}`}
        disabled={!hasSession}
        onClick={finish}
      >
        ✓ FINISH
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.dangerBtn}`}
        disabled={!hasSession}
        onClick={stop}
      >
        ■ STOP
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.dangerBtn}`}
        disabled={!hasSession}
        onClick={() => openModal("erase")}
      >
        ⌫ ERASE
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
