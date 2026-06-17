import { useState } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import styles from "./DurationControls.module.css";

const PRESETS: { label: string; seconds: number }[] = [
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "15m", seconds: 900 },
  { label: "Unlimited", seconds: 0 },
];

export function DurationControls() {
  const defaultDurationSec = useEvalStore((state) => state.defaultDurationSec);
  const setDefaultDuration = useEvalStore((state) => state.setDefaultDuration);
  const current = useEvalStore(selectCurrentSession);
  const [customMinutes, setCustomMinutes] = useState("");

  // Locked once the current session has begun (legacy: running || elapsed > 0).
  const locked = !!current && current.status !== "initial";

  const applyCustom = () => {
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    setDefaultDuration(minutes * 60);
    setCustomMinutes("");
  };

  return (
    <div className={styles.controls}>
      <span className={styles.label}>DEFAULT DURATION</span>
      <div className={styles.presets}>
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            className={`${styles.btn} ${
              defaultDurationSec === preset.seconds ? styles.active : ""
            }`}
            disabled={locked}
            onClick={() => setDefaultDuration(preset.seconds)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className={styles.custom}>
        <input
          className={styles.input}
          type="number"
          min={1}
          max={180}
          placeholder="MIN"
          value={customMinutes}
          disabled={locked}
          onChange={(event) => setCustomMinutes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyCustom();
          }}
        />
        <button
          type="button"
          className={styles.setBtn}
          disabled={locked}
          onClick={applyCustom}
        >
          SET
        </button>
      </div>
      <div className={styles.lockNote}>
        {locked ? "DURATION LOCKED FOR ACTIVE SESSION" : ""}
      </div>
    </div>
  );
}
