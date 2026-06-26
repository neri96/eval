import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { DEFAULT_PASSES, MAX_PASSES, MIN_PASSES } from "@/shared/constants";
import type { CubeOrder, GridMode } from "@/shared/types";
import styles from "./SessionMode.module.css";

const MODES: { value: GridMode; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "bowl appears at random" },
  { value: "matrix", label: "Matrix", hint: "every cube × bowl pairing" },
];

const ORDERS: { value: CubeOrder; label: string; hint: string }[] = [
  { value: "ordered", label: "Ordered", hint: "grid order · N passes" },
  { value: "random", label: "Random", hint: "shuffled · runs on the clock" },
];

export const SessionMode = () => {
  const current = useEvalStore(selectCurrentSession);
  const setGridMode = useEvalStore((state) => state.setGridMode);
  const setCubeOrder = useEvalStore((state) => state.setCubeOrder);
  const setPassTarget = useEvalStore((state) => state.setPassTarget);

  // Only meaningful for the cube-in-bowl task (lego has no grid).
  if (!current || current.taskId !== "cube-in-bowl") return null;

  const mode = current.gridMode ?? "standard";
  const order = current.cubeOrder ?? "ordered";
  const passTarget = current.passTarget ?? DEFAULT_PASSES;
  const cubePass = current.cubePass ?? 0;
  // Run setup is locked once the session leaves its pristine state.
  const locked = current.status !== "initial";

  const passLabel =
    order === "ordered"
      ? `PASS ${Math.min(cubePass + 1, passTarget)} / ${passTarget}`
      : `PASS ${cubePass + 1}`;

  const hint = ORDERS.find((o) => o.value === order)?.hint ?? "";

  return (
    <div className={styles.controls}>
      <div className={styles.group}>
        <span className={styles.label}>MODE</span>
        <div className={styles.segmented}>
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.hint}
              className={`${styles.btn} ${mode === m.value ? styles.active : ""}`}
              disabled={locked}
              onClick={() => setGridMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>ORDER</span>
        <div className={styles.segmented}>
          {ORDERS.map((o) => (
            <button
              key={o.value}
              type="button"
              title={o.hint}
              className={`${styles.btn} ${order === o.value ? styles.active : ""}`}
              disabled={locked}
              onClick={() => setCubeOrder(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>PASSES</span>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepBtn}
            disabled={locked || order !== "ordered" || passTarget <= MIN_PASSES}
            onClick={() => setPassTarget(passTarget - 1)}
          >
            −
          </button>
          <span className={styles.passCount}>
            {order === "ordered" ? passTarget : "∞"}
          </span>
          <button
            type="button"
            className={styles.stepBtn}
            disabled={locked || order !== "ordered" || passTarget >= MAX_PASSES}
            onClick={() => setPassTarget(passTarget + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.passProgress}>{passLabel}</span>
        <span className={styles.hint}>{hint}</span>
      </div>
    </div>
  );
};
