import type {
  EvalSession,
  EventId,
  LegoConfig,
  RemovedItem,
  SessionColor,
} from "@/shared/types";
import { DEFAULT_DURATION_SEC } from "@/shared/constants";
import { getTask } from "@/shared/tasks";
import {
  bank,
  cloneSession,
  createId,
  currentRollout,
  elapsedOf,
  finalizeOutgoing,
  isEmptySession,
  makeRollout,
  now,
  sanitizeComment,
  sanitizeDuration,
} from "../helpers";
import type { SliceCreator } from "../evalStore";

/**
 * Sessions slice — the session entity store plus the current-session
 * lifecycle, metadata, and scoring actions. Some actions reach into the
 * history/ui slices (selection, undo) via the shared store draft.
 */
export type SessionsSlice = {
  currentSessionId: string | null;
  sessions: EvalSession[];
  defaultDurationSec: number;
  defaultModel: string;

  getCurrentSession: () => EvalSession | null;

  createNewSession: () => void;
  startCurrentSession: () => void;
  pauseCurrentSession: () => void;
  finishCurrentSession: () => void;
  stopCurrentSession: () => void;
  restartCurrentSession: () => void;
  resumeSession: (sessionId: string) => void;

  // Multi-rollout (lego) lifecycle.
  completeRollout: () => void;
  glitchCurrentRollout: () => void;
  setLegoConfig: (config: Partial<LegoConfig>) => void;

  setCurrentTitle: (title: string) => void;
  setCurrentModel: (model: string) => void;
  setCurrentColor: (color: SessionColor) => void;
  setCurrentComment: (comment: string) => void;
  setDefaultDuration: (durationSec: number) => void;
  setDefaultModel: (model: string) => void;

  addSuccess: () => void;
  addFail: () => void;
  addEvent: (event: EventId) => void;
  undoLastEntry: () => void;
  deleteEntry: (sessionId: string, entryId: string) => void;

  renameSession: (sessionId: string, title: string) => void;
  setSessionComment: (sessionId: string, comment: string) => void;
  deleteSessions: (sessionIds: string[]) => void;
};

export const createSessionsSlice: SliceCreator<SessionsSlice> = (set, get) => ({
  currentSessionId: null,
  sessions: [],
  defaultDurationSec: DEFAULT_DURATION_SEC,
  defaultModel: "",

  getCurrentSession: () => {
    const { sessions, currentSessionId } = get();
    if (!currentSessionId) return null;
    return sessions.find((session) => session.id === currentSessionId) ?? null;
  },

  /* ---- lifecycle ---- */

  createNewSession: () =>
    set((state) => {
      const prev = state.sessions.find(
        (session) => session.id === state.currentSessionId,
      );
      // Don't stack duplicate blanks: if the current session is still pristine
      // (no model chosen, never run, nothing scored) for this same task, reuse
      // it instead of creating yet another empty session.
      if (prev && prev.taskId === state.activeTaskId && isEmptySession(prev)) {
        state.currentSessionId = prev.id;
        return;
      }
      if (prev) finalizeOutgoing(prev);

      const session: EvalSession = {
        id: createId("session"),
        taskId: state.activeTaskId,
        title: "",
        model: state.defaultModel,
        ticketId: state.currentTicketId || null,
        comment: "",
        color: null,
        status: "initial",
        durationSec: state.defaultDurationSec,
        startedAt: now(),
        endedAt: null,
        rollouts: [makeRollout(0)],
      };

      // Multi-rollout tasks (lego) carry per-session run config and measure
      // pieces rather than a time target, so the clock counts up (no auto-finish).
      const task = getTask(state.activeTaskId);
      if (task.kind === "multi-rollout" && task.defaultLego) {
        session.lego = { ...task.defaultLego };
        session.durationSec = 0;
      }

      state.sessions.unshift(session);
      state.currentSessionId = session.id;
    }),

  startCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status === "done" || session.status === "stopped")
        return;
      if (!session.model.trim()) return;
      const rollout = currentRollout(session);
      if (!rollout.runningSince) rollout.runningSince = now();
      session.status = "active";
    }),

  pauseCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      bank(currentRollout(session));
      session.status = "paused";
    }),

  finishCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      const rollout = currentRollout(session);
      bank(rollout);
      rollout.endedAt = now();
      session.status = "done";
      session.endedAt = now();
    }),

  stopCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      const rollout = currentRollout(session);
      bank(rollout);
      rollout.endedAt = now();
      session.status = "stopped";
      session.endedAt = now();
    }),

  // Nullify a session's progress and return it to the pristine "initial"
  // state, keeping its identity and configuration (title, model, color,
  // comment, ticket, target duration, sort timestamp).
  restartCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      session.status = "initial";
      session.endedAt = null;
      session.rollouts = [makeRollout(0)];
    }),

  resumeSession: (sessionId) =>
    set((state) => {
      if (state.currentSessionId && state.currentSessionId !== sessionId) {
        const prev = state.sessions.find(
          (item) => item.id === state.currentSessionId,
        );
        if (prev) finalizeOutgoing(prev);
      }
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return;
      state.currentSessionId = sessionId;
      session.status = "paused";
      session.endedAt = null;
    }),

  /* ---- multi-rollout (lego) lifecycle ---- */

  // Mark the current rollout cleanly finished and open the next one. Honors the
  // session's auto/manual next-rollout preference.
  completeRollout: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status === "done" || session.status === "stopped")
        return;
      const rollout = currentRollout(session);
      bank(rollout);
      rollout.endedAt = now();
      rollout.outcome = "clean";
      const next = makeRollout(session.rollouts.length);
      session.rollouts.push(next);
      if (session.lego?.autoNextRollout) {
        next.runningSince = now();
        session.status = "active";
      } else {
        session.status = "paused";
      }
    }),

  // Plate confusion: log the glitch, end the current rollout as glitched, and
  // arm a fresh rollout for the operator to start.
  glitchCurrentRollout: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status === "done" || session.status === "stopped")
        return;
      const rollout = currentRollout(session);
      rollout.entries.push({
        id: createId("entry"),
        kind: "anomaly",
        anomaly: "glitch",
        at: now(),
        elapsedMs: elapsedOf(rollout),
      });
      bank(rollout);
      rollout.endedAt = now();
      rollout.outcome = "glitched";
      session.rollouts.push(makeRollout(session.rollouts.length));
      session.status = "paused";
    }),

  setLegoConfig: (config) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || !session.lego) return;
      Object.assign(session.lego, config);
    }),

  /* ---- metadata ---- */

  setCurrentTitle: (title) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (session) session.title = title.trim();
    }),

  setCurrentModel: (model) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (session) session.model = model.trim();
    }),

  setCurrentColor: (color) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (session) session.color = color;
    }),

  setCurrentComment: (comment) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (session) session.comment = sanitizeComment(comment);
    }),

  setDefaultDuration: (durationSec) =>
    set((state) => {
      const duration = sanitizeDuration(durationSec);
      state.defaultDurationSec = duration;
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (session && session.status === "initial") {
        session.durationSec = duration;
      }
    }),

  setDefaultModel: (model) =>
    set((state) => {
      state.defaultModel = model.trim();
    }),

  /* ---- scoring ---- */

  addSuccess: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      const rollout = currentRollout(session);
      rollout.entries.push({
        id: createId("entry"),
        kind: "verdict",
        verdict: "success",
        at: now(),
        elapsedMs: elapsedOf(rollout),
      });
    }),

  addFail: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      const rollout = currentRollout(session);
      rollout.entries.push({
        id: createId("entry"),
        kind: "verdict",
        verdict: "fail",
        at: now(),
        elapsedMs: elapsedOf(rollout),
      });
    }),

  addEvent: (event) =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      // Only events in the session's task vocabulary are accepted.
      if (!getTask(session.taskId).events.some((def) => def.id === event)) {
        return;
      }
      const rollout = currentRollout(session);
      // A bad grasp still means a successful placement happened.
      if (event === "bad_grasp") {
        rollout.entries.push({
          id: createId("entry"),
          kind: "verdict",
          verdict: "success",
          at: now(),
          elapsedMs: elapsedOf(rollout),
        });
      }
      rollout.entries.push({
        id: createId("entry"),
        kind: "anomaly",
        anomaly: event,
        at: now(),
        elapsedMs: elapsedOf(rollout),
      });
    }),

  undoLastEntry: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      const rollout = currentRollout(session);
      if (!rollout.entries.length) return;
      rollout.entries.pop();
    }),

  // Remove a single entry from whichever rollout of any session holds it.
  // Works live (current rollout) and historically (finished sessions).
  deleteEntry: (sessionId, entryId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return;
      for (const rollout of session.rollouts) {
        const index = rollout.entries.findIndex(
          (entry) => entry.id === entryId,
        );
        if (index !== -1) {
          rollout.entries.splice(index, 1);
          return;
        }
      }
    }),

  /* ---- list management ---- */

  renameSession: (sessionId, title) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (session) session.title = title.trim();
    }),

  setSessionComment: (sessionId, comment) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (session) session.comment = sanitizeComment(comment);
    }),

  deleteSessions: (sessionIds) => {
    const ids = new Set(sessionIds);
    const { sessions, currentSessionId } = get();
    const removed: RemovedItem[] = [];
    sessions.forEach((session, index) => {
      if (ids.has(session.id)) {
        removed.push({
          session: cloneSession(session),
          index,
          wasCurrent: session.id === currentSessionId,
        });
      }
    });
    if (!removed.length) return;
    set((state) => {
      state.sessions = state.sessions.filter((session) => !ids.has(session.id));
      state.selectedSessionIds = state.selectedSessionIds.filter(
        (id) => !ids.has(id),
      );
      if (state.currentSessionId && ids.has(state.currentSessionId)) {
        state.currentSessionId = null;
      }
      state.recentlyRemoved = { items: removed, at: Date.now() };
    });
  },
});
