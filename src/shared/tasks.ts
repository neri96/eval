import type {
  EventId,
  EventValence,
  LegoConfig,
  SessionColor,
  TaskId,
} from "./types";

/** A task-defined timeline event (the buttons under the scoring area). */
export type EventDef = {
  id: EventId;
  label: string;
  hotkey?: string;
  valence: EventValence;
  /** When true, logging this event ends the current rollout (lego glitch). */
  endsRollout?: boolean;
  /**
   * Primary key-driven marker (bad grasp via arrow-down) rather than a row
   * button: hidden from the event row, voice vocab, and letter hotkeys, and
   * counted as its own category (not part of the event profile).
   */
  primary?: boolean;
};

export type TaskDefinition = {
  id: TaskId;
  label: string;
  blurb: string;
  /**
   * Run model. "single-rollout" = one timed run per session (cube);
   * "multi-rollout" = several runs per session (lego).
   */
  kind: "single-rollout" | "multi-rollout";
  /** Categorical color palette; empty = the task has no color dimension. */
  colors: readonly SessionColor[];
  /** Timeline event vocabulary for this task. */
  events: readonly EventDef[];
  /** Piece-count presets for multi-rollout tasks (0 = unlimited). */
  pieceCountPresets?: readonly number[];
  /** Default per-session config for multi-rollout tasks. */
  defaultLego?: LegoConfig;
  /** Whether the task's workspace is ready. Unavailable tasks show as "soon". */
  available: boolean;
};

export const TASKS: Record<TaskId, TaskDefinition> = {
  "cube-in-bowl": {
    id: "cube-in-bowl",
    label: "Cube in Bowl",
    blurb:
      "Live success/fail scoring of a single timed run, compared by color.",
    kind: "single-rollout",
    colors: ["red", "yellow", "blue"],
    events: [
      { id: "collision", label: "Collision", hotkey: "c", valence: "negative" },
      { id: "dropped", label: "Dropped", hotkey: "d", valence: "negative" },
      { id: "phantom", label: "Phantom", hotkey: "p", valence: "negative" },
      { id: "shaky", label: "Shaky", hotkey: "s", valence: "negative" },
      { id: "random", label: "Random", hotkey: "r", valence: "negative" },
      {
        id: "bad_grasp",
        label: "Bad Grasp",
        valence: "negative",
        primary: true,
      },
    ],
    available: true,
  },
  "lego-transfer": {
    id: "lego-transfer",
    label: "Lego Transfer",
    blurb:
      "Multi-rollout piece transfer scored by speed, attempts, and events.",
    kind: "multi-rollout",
    colors: [],
    events: [
      { id: "spill", label: "Spill", hotkey: "s", valence: "negative" },
      {
        id: "ignored_outside",
        label: "Ignored Outside",
        hotkey: "i",
        valence: "negative",
      },
      { id: "dropped", label: "Dropped", hotkey: "d", valence: "negative" },
      { id: "miss", label: "Miss", hotkey: "m", valence: "negative" },
      {
        id: "multi_grab",
        label: "Multi-grab",
        hotkey: "g",
        valence: "negative",
      },
      {
        id: "glitch",
        label: "Glitch",
        hotkey: "x",
        valence: "negative",
        endsRollout: true,
      },
      {
        id: "good_recovery",
        label: "Good Recovery",
        hotkey: "v",
        valence: "positive",
      },
      {
        id: "bad_grasp",
        label: "Bad Grasp",
        valence: "negative",
        primary: true,
      },
    ],
    pieceCountPresets: [10, 20, 30, 0],
    defaultLego: {
      pieceCount: 40,
      resumeProgress: true,
      autoNextRollout: false,
    },
    available: true,
  },
};

/** Ordered list for rendering (registry insertion order). */
export const TASK_LIST: readonly TaskDefinition[] = Object.values(TASKS);

/** The task assumed for any data that predates the multi-task model. */
export const DEFAULT_TASK_ID: TaskId = "cube-in-bowl";

export function getTask(id: TaskId): TaskDefinition {
  return TASKS[id] ?? TASKS[DEFAULT_TASK_ID];
}

export function isTaskId(value: unknown): value is TaskId {
  return typeof value === "string" && value in TASKS;
}

/** Active color palette for a task; empty array when color is irrelevant. */
export function taskColors(id: TaskId): readonly SessionColor[] {
  return getTask(id).colors;
}

/** The task's event vocabulary. */
export function taskEvents(id: TaskId): readonly EventDef[] {
  return getTask(id).events;
}

/** Look up a single event definition by id within a task. */
export function getEventDef(
  id: TaskId,
  eventId: EventId,
): EventDef | undefined {
  return getTask(id).events.find((event) => event.id === eventId);
}
