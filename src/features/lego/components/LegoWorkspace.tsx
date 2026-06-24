import { useEffect, useRef, useState } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { currentRollout, elapsedOf } from "@/store/helpers";
import { getTask } from "@/shared/tasks";
import type { Rollout } from "@/shared/types";
import { formatClock } from "@/shared/utils/time";
import { useElapsedTick } from "@/features/sessions/hooks/useElapsedTick";
import {
  FOCUS_MODEL_INPUT_EVENT,
  SessionMeta,
} from "@/features/sessions/components/SessionMeta";
import { VoiceControls } from "@/features/voice/VoiceControls";
import { LiveEntryFeed } from "@/features/scoring/components/LiveEntryFeed";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import styles from "./LegoWorkspace.module.css";

const FALLBACK_CONFIG = {
  pieceCount: 0,
  resumeProgress: true,
  autoNextRollout: false,
};

function placedIn(rollout: Rollout): number {
  return rollout.entries.filter(
    (entry) => entry.kind === "verdict" && entry.verdict === "success",
  ).length;
}

function failedIn(rollout: Rollout): number {
  return rollout.entries.filter(
    (entry) => entry.kind === "verdict" && entry.verdict === "fail",
  ).length;
}

function Count({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.countRow}>
      <span className={styles.countLabel}>{label}</span>
      <span className={styles.countValue}>{value}</span>
    </div>
  );
}

export function LegoWorkspace() {
  useElapsedTick();

  const current = useEvalStore(selectCurrentSession);
  const createNewSession = useEvalStore((s) => s.createNewSession);
  const setDefaultModel = useEvalStore((s) => s.setDefaultModel);
  const startCurrentSession = useEvalStore((s) => s.startCurrentSession);
  const pauseCurrentSession = useEvalStore((s) => s.pauseCurrentSession);
  const finishCurrentSession = useEvalStore((s) => s.finishCurrentSession);
  const completeRollout = useEvalStore((s) => s.completeRollout);
  const glitchCurrentRollout = useEvalStore((s) => s.glitchCurrentRollout);
  const setLegoConfig = useEvalStore((s) => s.setLegoConfig);
  const addSuccess = useEvalStore((s) => s.addSuccess);
  const addFail = useEvalStore((s) => s.addFail);
  const addEvent = useEvalStore((s) => s.addEvent);
  const openModal = useEvalStore((s) => s.openModal);

  const task = getTask("lego-transfer");
  const events = task.events.filter(
    (event) => !event.endsRollout && !event.primary,
  );
  const presets = task.pieceCountPresets ?? [];

  const status = current?.status ?? null;
  const isInitial = status === "initial";
  const isActive = status === "active";
  const isPaused = status === "paused";
  const isOngoing = isActive || isPaused;

  const rollout = current ? currentRollout(current) : null;
  const elapsed = rollout ? elapsedOf(rollout) : 0;

  const cfg = current?.lego ?? task.defaultLego ?? FALLBACK_CONFIG;
  const configLocked = !current || !isInitial;
  const unlimited = cfg.pieceCount === 0;

  const placedThis = rollout ? placedIn(rollout) : 0;
  const failedThis = rollout ? failedIn(rollout) : 0;
  const attemptsThis = placedThis + failedThis;
  const effThis = placedThis > 0 ? (attemptsThis / placedThis).toFixed(2) : "—";
  const badGraspsThis = rollout
    ? rollout.entries.filter(
        (entry) => entry.kind === "anomaly" && entry.anomaly === "bad_grasp",
      ).length
    : 0;

  const rollouts = current?.rollouts ?? [];
  const totalPlaced = rollouts.reduce((sum, r) => sum + placedIn(r), 0);
  const totalFailed = rollouts.reduce((sum, r) => sum + failedIn(r), 0);
  const totalAttempts = totalPlaced + totalFailed;
  const sessionEff =
    totalPlaced > 0 ? (totalAttempts / totalPlaced).toFixed(2) : "—";

  const placedTowardTarget = cfg.resumeProgress ? totalPlaced : placedThis;
  const remaining = unlimited
    ? null
    : Math.max(0, cfg.pieceCount - placedTowardTarget);

  const [flash, setFlash] = useState<"placed" | "failed" | "bad_grasp" | null>(
    null,
  );
  const prevCounts = useRef({ placed: 0, failed: 0, badGrasps: 0 });

  useEffect(() => {
    if (badGraspsThis > prevCounts.current.badGrasps) setFlash("bad_grasp");
    else if (placedThis > prevCounts.current.placed) setFlash("placed");
    else if (failedThis > prevCounts.current.failed) setFlash("failed");
    prevCounts.current = {
      placed: placedThis,
      failed: failedThis,
      badGrasps: badGraspsThis,
    };
  }, [badGraspsThis, failedThis, placedThis]);

  const rolloutStarted =
    !!rollout &&
    (rollout.accumulatedMs > 0 ||
      rollout.entries.length > 0 ||
      !!rollout.runningSince);
  const startLabel = isPaused && rolloutStarted ? "RESUME" : "START ROLLOUT";
  const hasModel = !!current?.model.trim();
  const canStart = !!current && hasModel && (isInitial || isPaused);

  const newSession = () => {
    setDefaultModel("");
    createNewSession();
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(FOCUS_MODEL_INPUT_EVENT));
    });
  };

  return (
    <>
      <div className={styles.head}>
        <div className={styles.headLabel}>
          {current ? `ROLLOUT ${rollout!.index + 1}` : "LEGO TRANSFER"}
          {current && (
            <span className={styles.headStatus}>
              {" "}
              · {status!.toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.timer}>
          {formatClock(Math.floor(elapsed / 1000))}
        </div>
        <div className={styles.pieceLine}>
          {!current ? (
            "PRESS + NEW SESSION TO BEGIN"
          ) : unlimited ? (
            <>
              <b>{placedThis}</b> placed this rollout
            </>
          ) : (
            <>
              <b>{placedTowardTarget}</b> / {cfg.pieceCount} placed
              {remaining !== null && <> · {remaining} left</>}
            </>
          )}
        </div>
      </div>

      <div className={styles.config}>
        <span className={styles.configLabel}>PIECES</span>
        <div className={styles.presets}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={configLocked}
              className={`${styles.preset} ${
                cfg.pieceCount === preset ? styles.presetActive : ""
              }`}
              onClick={() => setLegoConfig({ pieceCount: preset })}
            >
              {preset === 0 ? "∞" : preset}
            </button>
          ))}
          <input
            type="number"
            min={1}
            disabled={configLocked}
            className={styles.pieceInput}
            value={cfg.pieceCount === 0 ? "" : cfg.pieceCount}
            placeholder="—"
            onChange={(event) => {
              const n = parseInt(event.target.value, 10);
              setLegoConfig({
                pieceCount: Number.isFinite(n) && n > 0 ? n : 0,
              });
            }}
          />
        </div>
        <button
          type="button"
          disabled={configLocked}
          className={styles.toggle}
          onClick={() => setLegoConfig({ resumeProgress: !cfg.resumeProgress })}
        >
          NEW ROLLOUT: <b>{cfg.resumeProgress ? "RESUME" : "RESTART"}</b>
        </button>
        <button
          type="button"
          disabled={configLocked}
          className={styles.toggle}
          onClick={() =>
            setLegoConfig({ autoNextRollout: !cfg.autoNextRollout })
          }
        >
          AFTER CLEAN: <b>{cfg.autoNextRollout ? "AUTO-NEXT" : "MANUAL"}</b>
        </button>
      </div>

      <SessionMeta />

      <div className={styles.transport}>
        <button
          type="button"
          className={styles.btn}
          disabled={!canStart}
          onClick={startCurrentSession}
          title={current && !hasModel ? "Set a model before starting" : undefined}
        >
          {current && !hasModel ? "SET MODEL TO START" : `▶ ${startLabel}`}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={!isActive}
          onClick={pauseCurrentSession}
        >
          ⏸ PAUSE
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.warnBtn}`}
          disabled={!isOngoing}
          onClick={glitchCurrentRollout}
        >
          ⚡ GLITCH
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.successBtn}`}
          disabled={!isOngoing}
          onClick={completeRollout}
        >
          ✓ COMPLETE ROLLOUT
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.finishBtn}`}
          disabled={!isOngoing}
          onClick={finishCurrentSession}
        >
          ■ FINISH
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={!(current && !isInitial)}
          onClick={() => openModal("restart")}
        >
          ↻ RESTART
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.newBtn}`}
          onClick={newSession}
        >
          + NEW SESSION
        </button>
      </div>

      <div className={styles.scoring}>
        <button
          type="button"
          className={`${styles.scoreBtn} ${styles.placed} ${
            flash === "placed" ? styles.flashPlaced : ""
          }`}
          disabled={!isActive}
          onClick={addSuccess}
          onAnimationEnd={() => setFlash(null)}
        >
          ＋ PLACED
          <span className={styles.scoreHint}>← LEFT ARROW</span>
        </button>

        <div className={styles.counts}>
          <Count label="PLACED" value={placedThis} />
          <Count label="FAILED" value={failedThis} />
          <Count label="BAD GRASP" value={badGraspsThis} />
          <Count label="ATT / PIECE" value={effThis} />
        </div>

        <button
          type="button"
          className={`${styles.scoreBtn} ${styles.failed} ${
            flash === "failed" ? styles.flashFailed : ""
          }`}
          disabled={!isActive}
          onClick={addFail}
          onAnimationEnd={() => setFlash(null)}
        >
          ✕ FAILED ATTEMPT
          <span className={styles.scoreHint}>→ RIGHT ARROW</span>
        </button>
      </div>

      <div className={styles.badGraspRow}>
        <button
          type="button"
          className={`${styles.badGraspBtn} ${
            flash === "bad_grasp" ? styles.flashBadGrasp : ""
          }`}
          disabled={!isActive}
          onClick={() => addEvent("bad_grasp")}
          onAnimationEnd={() => setFlash(null)}
        >
          ↓ BAD GRASP
        </button>
      </div>

      <div className={styles.events}>
        <span className={styles.eventsLabel}>EVENTS</span>
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            className={`${styles.eventBtn} ${
              event.valence === "positive" ? styles.positive : styles.negative
            }`}
            disabled={!isActive}
            onClick={() => addEvent(event.id)}
          >
            {event.hotkey && <kbd>{event.hotkey.toUpperCase()}</kbd>}{" "}
            {event.label}
          </button>
        ))}
      </div>

      <VoiceControls />

      <LiveEntryFeed />

      {current && rollouts.length > 0 && (
        <div className={styles.strip}>
          <span className={styles.stripLabel}>ROLLOUTS</span>
          <div className={styles.chips}>
            {rollouts.map((r) => {
              const placed = placedIn(r);
              const cls =
                r.outcome === "clean"
                  ? styles.clean
                  : r.outcome === "glitched"
                    ? styles.glitched
                    : r === rollout
                      ? styles.currentChip
                      : styles.pending;
              const mark =
                r.outcome === "clean"
                  ? "✓"
                  : r.outcome === "glitched"
                    ? "⚡"
                    : "";
              return (
                <span key={r.id} className={`${styles.chip} ${cls}`}>
                  R{r.index + 1} · {placed} {mark}
                </span>
              );
            })}
          </div>
          <span className={styles.stripTotals}>
            {totalPlaced} placed · {totalFailed} failed · {rollouts.length}{" "}
            rollouts · {sessionEff} att/piece
          </span>
        </div>
      )}

      <HistoryPanel />
    </>
  );
}
