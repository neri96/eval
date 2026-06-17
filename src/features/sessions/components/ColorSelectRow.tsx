import type { SessionColor } from "@/shared/types";
import { SESSION_COLORS } from "@/shared/constants";
import styles from "./ColorSelectRow.module.css";

type ColorSelectRowProps = {
  open: boolean;
  onPick: (color: SessionColor) => void;
  onCancel: () => void;
};

export function ColorSelectRow({ open, onPick, onCancel }: ColorSelectRowProps) {
  if (!open) return null;

  return (
    <div className={styles.row}>
      <span className={styles.label}>SELECT COLOR</span>
      {SESSION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${styles.option} ${styles[color]}`}
          onClick={() => onPick(color)}
        >
          {color.toUpperCase()}
        </button>
      ))}
      <button type="button" className={styles.cancel} onClick={onCancel}>
        ✕ CANCEL
      </button>
    </div>
  );
}
