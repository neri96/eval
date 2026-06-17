import { useState } from "react";
import type { AnomalyKind } from "@/shared/types";
import { EVENT_TYPES } from "@/shared/constants";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import styles from "./EventRow.module.css";

const EVENT_CLASS: Record<AnomalyKind, string> = {
  collision: styles.collision,
  dropped: styles.dropped,
  phantom: styles.phantom,
  shaky: styles.shaky,
  random: styles.random,
};

export function EventRow() {
  const current = useEvalStore(selectCurrentSession);
  const addEvent = useEvalStore((state) => state.addEvent);
  const isActive = current?.status === "active";
  const [flashed, setFlashed] = useState<AnomalyKind | null>(null);

  return (
    <div className={styles.row}>
      <span className={styles.label}>EVENTS</span>
      {EVENT_TYPES.map((type) => (
        <button
          key={type.id}
          type="button"
          className={`${styles.btn} ${EVENT_CLASS[type.id]} ${
            flashed === type.id ? styles.flash : ""
          }`}
          disabled={!isActive}
          onClick={() => {
            addEvent(type.id);
            setFlashed(type.id);
          }}
          onAnimationEnd={() => setFlashed(null)}
        >
          <kbd>{type.key.toUpperCase()}</kbd> {type.label}
        </button>
      ))}
    </div>
  );
}
