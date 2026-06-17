import type { AnomalyKind, SessionColor } from "./types";

/* Domain constants — used by both the store and feature UI
 * (color picker, event buttons, duration input, comment counter). */

export const SESSION_COLORS: readonly SessionColor[] = ["red", "yellow", "blue"];

export const ANOMALY_KINDS: readonly AnomalyKind[] = [
  "collision",
  "dropped",
  "phantom",
  "shaky",
  "random",
];

/** Anomaly event metadata — label + keyboard hotkey (mirrors legacy EVENT_TYPES). */
export const EVENT_TYPES: readonly { id: AnomalyKind; label: string; key: string }[] =
  [
    { id: "collision", label: "Collision", key: "c" },
    { id: "dropped", label: "Dropped", key: "d" },
    { id: "phantom", label: "Phantom", key: "p" },
    { id: "shaky", label: "Shaky", key: "s" },
    { id: "random", label: "Random", key: "r" },
  ];

export const DEFAULT_DURATION_SEC = 300;
export const UNLIMITED_DURATION = 0;
export const MIN_DURATION_SEC = 60;
export const MAX_DURATION_SEC = 3 * 60 * 60;
export const COMMENT_MAX = 280;
export const MAX_OPERATORS = 20;
