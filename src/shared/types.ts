/* ------------------------------------------------------------------ *
 * Domain types — the entity shapes. Features depend on these directly;
 * they never need to import the store to know what a Session is.
 * ------------------------------------------------------------------ */

import type { PositionId } from "./grid";

export type SessionStatus =
  | "initial" // created, never started
  | "active" // clock running
  | "paused" // started then paused
  | "done" // finished (reached target / Finish)
  | "stopped"; // ended early / archived incomplete

export type SessionColor = "red" | "yellow" | "blue";

/** Which evaluation task a session/ticket belongs to (see shared/tasks.ts). */
export type TaskId = "cube-in-bowl" | "lego-transfer";

export type Verdict = "success" | "fail";

/** Cube-in-bowl bowl behavior: random placement vs. systematic cube×bowl sweep. */
export type GridMode = "standard" | "matrix";

/** Cube traversal order within a pass (also picks the run's stop rule). */
export type CubeOrder = "ordered" | "random";

export type AnomalyKind =
  | "collision"
  | "dropped"
  | "phantom"
  | "shaky"
  | "random"
  | "spill"
  | "ignored_outside"
  | "miss"
  | "multi_grab"
  | "glitch"
  | "good_recovery"
  | "bad_grasp";

/** Lego-transfer event ids that aren't shared with the cube task. */
export type LegoEventId =
  | "spill" // pieces pushed outside a plate
  | "ignored_outside" // a piece outside a plate left ungrabbed
  | "miss" // grasp attempt that grabbed nothing
  | "multi_grab" // grabbed more than one piece at once
  | "glitch" // plate confusion — terminates the rollout
  | "good_recovery"; // positive: recovered from a fault

/** A dirty/clean-quality marker on a success — logged via arrow-down. */
export type GraspEventId = "bad_grasp";

/** Any task-defined event id (cube anomalies + lego events + grasp quality). */
export type EventId = AnomalyKind | LegoEventId | GraspEventId;

/** Whether an event reflects a fault (negative) or a good outcome (positive). */
export type EventValence = "negative" | "positive";

/**
 * Grid context captured on an entry at the moment it was logged (cube-in-bowl
 * only). The cube advances on every verdict, so this freezes where the cube and
 * bowl actually were for this attempt; `attempt` is the 1-based attempt index
 * within the session. Absent for tasks without a grid (lego) and on legacy data.
 */
export type GridContext = {
  cubeCell?: string; // e.g. "A2"
  bowlCell?: string; // e.g. "C3"
  attempt?: number; // 1-based attempt number within the session
};

/** One ordered timeline entry — a verdict or an event (mirrors legacy `entries`). */
export type SessionEntry =
  | ({
      id: string;
      kind: "verdict";
      verdict: Verdict;
      at: string; // ISO timestamp
      elapsedMs: number; // session clock at the moment it was logged
    } & GridContext)
  | ({
      id: string;
      kind: "anomaly";
      anomaly: EventId; // task-defined event id (cube anomaly or lego event)
      at: string;
      elapsedMs: number;
    } & GridContext);

/**
 * A derived, attempt-centric view of a session's timeline: one record per
 * verdict (the attempt's result) with the grid placement it happened at and any
 * events logged during that same attempt grouped in. Built by `getAttempts`;
 * not stored — the timeline `entries` remain the source of truth.
 */
export type AttemptRecord = {
  id: string; // the verdict entry's id (or a synthetic id for eventless attempts)
  sessionId: string;
  attempt: number; // 1-based
  cubePosition: string | null; // "A2", or null for grid-less tasks
  bowlPosition: string | null; // "C3", or null
  result: Verdict | null; // null while the attempt only has events so far
  events: EventId[];
  at: string;
  elapsedMs: number;
};

/**
 * One timed run within a session. Cube-in-bowl has exactly one rollout;
 * multi-rollout tasks (e.g. Lego transfer) accumulate several. The clock and
 * the entry stream live here — the session owns identity, config, and the
 * overall lifecycle.
 */
/** How a rollout ended (lego); null while in progress or for cube. */
export type RolloutOutcome = "clean" | "glitched" | null;

export type Rollout = {
  id: string;
  index: number; // 0-based order within the session
  startedAt: string; // ISO
  endedAt: string | null;
  outcome: RolloutOutcome;
  // clock accounting (wall-clock; survives pause/resume + reload)
  accumulatedMs: number; // time banked from previous running segments
  runningSince: string | null; // ISO while running, null when paused/ended
  entries: SessionEntry[];
};

/** Per-session lego configuration (defaults come from the task definition). */
export type LegoConfig = {
  pieceCount: number; // target pieces per rollout; 0 = unlimited
  resumeProgress: boolean; // a new rollout resumes piece progress vs. restarts
  autoNextRollout: boolean; // after a clean rollout, auto-start the next
};

export type EvalSession = {
  id: string;
  taskId: TaskId;
  title: string;
  model: string;
  ticketId: string | null;
  comment: string;
  color: SessionColor | null;
  status: SessionStatus; // overall session lifecycle
  durationSec: number; // target; 0 = unlimited
  startedAt: string; // immutable creation/sort timestamp (ISO)
  endedAt: string | null;
  rollouts: Rollout[]; // always >= 1; the last entry is the current run
  lego?: LegoConfig; // present only for multi-rollout (lego) sessions
  cubePosition?: PositionId; // grid cell holding the cube (cube-in-bowl only)
  bowlPosition?: PositionId; // grid cell holding the bowl (cube-in-bowl only)
  gridMode?: GridMode; // bowl behavior (cube-in-bowl only)
  cubeOrder?: CubeOrder; // cube traversal order + stop rule (cube-in-bowl only)
  passTarget?: number; // ordered: passes to run before auto-finishing
  cubePass?: number; // passes the cube has completed so far
  passQueue?: PositionId[]; // cells the cube still has to visit this pass
};

export type Ticket = {
  id: string;
  taskId: TaskId;
  name: string;
  operators: string[];
  createdAt: string;
};

export type HistoryStatusFilter = "all" | "active" | "done" | "stopped";
export type HistorySort = "newest" | "oldest" | "best" | "worst" | "fastest";
export type HistoryTicketFilter = "all" | "ungrouped" | (string & {});
export type SummaryView = "list" | "chart" | "models" | "analytics";
export type SummaryGraphMetric = "score" | "rate" | "total";
export type ModalName =
  | "renameSession"
  | "ticket"
  | "deleteTicket"
  | "deleteSelected"
  | "restart"
  | "selectionSummary"
  | null;

/** Undo snapshot for deletion (held transiently, not persisted). */
export type RemovedItem = {
  session: EvalSession;
  index: number;
  wasCurrent: boolean;
};
export type RemovedSnapshot = { items: RemovedItem[]; at: number };
