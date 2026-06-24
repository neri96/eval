import { useEffect } from "react";
import { useEvalStore } from "@/store/evalStore";
import { useVoice } from "./useVoice";
import styles from "./VoiceControls.module.css";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
};

const isPttKey = (event: KeyboardEvent) =>
  event.code === "ShiftLeft" || event.code === "ShiftRight";

export function VoiceControls() {
  const pttAvailable = useEvalStore(
    (state) => state.getCurrentSession()?.status === "active",
  );
  const {
    supported,
    verdictOn,
    toggleVerdict,
    pttHeld,
    startPtt,
    endPtt,
    interim,
    feedback,
  } = useVoice();

  // Hold Shift = push-to-talk for an event (ignored while typing in a field).
  useEffect(() => {
    if (!supported) return;
    const down = (event: KeyboardEvent) => {
      if (!isPttKey(event) || event.repeat) return;
      if (!pttAvailable || isEditableTarget(event.target)) return;
      event.preventDefault();
      startPtt();
    };
    const up = (event: KeyboardEvent) => {
      if (!isPttKey(event)) return;
      if (!pttHeld) return;
      event.preventDefault();
      endPtt();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [supported, pttAvailable, pttHeld, startPtt, endPtt]);

  if (!supported) {
    return (
      <div className={styles.bar}>
        <span className={styles.unsupported}>
          🎤 Voice input isn't supported in this browser
        </span>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={`${styles.toggle} ${verdictOn ? styles.on : ""}`}
        onClick={toggleVerdict}
        title="Continuously listen for placed/failed"
      >
        <span className={styles.dot} /> VERDICTS {verdictOn ? "ON" : "OFF"}
      </button>

      <button
        type="button"
        className={`${styles.ptt} ${pttHeld ? styles.held : ""}`}
        onPointerDown={(event) => {
          if (!pttAvailable) return;
          event.preventDefault();
          startPtt();
        }}
        onPointerUp={endPtt}
        onPointerLeave={() => {
          if (pttHeld) endPtt();
        }}
        disabled={!pttAvailable}
        title={
          pttAvailable
            ? "Hold to listen for an event"
            : "Start or resume a rollout to use event voice input"
        }
      >
        🎤 HOLD FOR EVENT <kbd>SHIFT</kbd>
      </button>

      <span className={styles.status}>
        {pttHeld ? (
          <span className={styles.listening}>{interim || "listening…"}</span>
        ) : feedback ? (
          <span className={feedback.ok ? styles.ok : styles.bad}>
            {feedback.text}
          </span>
        ) : (
          ""
        )}
      </span>
    </div>
  );
}
