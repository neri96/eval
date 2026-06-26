import type { CSSProperties } from "react";

import { useEvalStore } from "@/store/evalStore";
import type { SessionColor } from "@/shared/types";
import { POSITIONS, type PositionId } from "@/shared/grid";

import styles from "./EvalGrid.module.css";

type EvalGridProps = {
  onSelectPosition?: (id: PositionId) => void;
};

/** Session color → CSS color token; cyan accent when no color is chosen. */
const CUBE_COLOR: Record<SessionColor, string> = {
  red: "var(--fail)",
  yellow: "var(--warn)",
  blue: "var(--blue)",
};

/** Isometric 3-face cube, tinted to the active session color via --cube-color. */
function CubeIcon({ color }: { color: string }) {
  return (
    <svg
      className={styles.cubeSvg}
      style={{ "--cube-color": color } as CSSProperties}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <polygon className={styles.cubeRight} points="50,52 84,34 84,70 50,90" />
      <polygon className={styles.cubeLeft} points="16,34 50,52 50,90 16,70" />
      <polygon className={styles.cubeTop} points="50,14 84,34 50,52 16,34" />
    </svg>
  );
}

/** A simple ceramic bowl with a rounded lip and a shadowed cavity. */
function BowlIcon() {
  return (
    <svg className={styles.bowlSvg} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="bowlBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef2f8" />
          <stop offset="1" stopColor="#9aa6ba" />
        </linearGradient>
      </defs>
      <path
        className={styles.bowlBody}
        d="M15,54 C17,77 32,90 50,90 C68,90 83,77 85,54 Z"
      />
      <ellipse className={styles.bowlRim} cx="50" cy="54" rx="35" ry="9" />
      <ellipse className={styles.bowlInner} cx="50" cy="54" rx="28" ry="6.5" />
    </svg>
  );
}

export function EvalGrid({ onSelectPosition }: EvalGridProps) {
  const session = useEvalStore((state) => state.getCurrentSession());
  const cubeColor = session?.color ? CUBE_COLOR[session.color] : "var(--accent)";

  return (
    <div className={styles.grid}>
      {POSITIONS.map((position) => {
        const hasCube = position.id === session?.cubePosition;
        const hasBowl = position.id === session?.bowlPosition;

        return (
          <button
            key={position.id}
            className={styles.cell}
            onClick={() => onSelectPosition?.(position.id)}
          >
            <span className={styles.label}>{position.cell}</span>

            <div className={styles.icons}>
              {hasCube && <CubeIcon color={cubeColor} />}
              {hasBowl && <BowlIcon />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
