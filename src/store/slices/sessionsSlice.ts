import type {
  AnomalyKind,
  EvalSession,
  RemovedItem,
  SessionColor,
} from "@/shared/types";
import { ANOMALY_KINDS, DEFAULT_DURATION_SEC } from "@/shared/constants";
import {
  bank,
  cloneSession,
  createId,
  elapsedOf,
  finalizeOutgoing,
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
  eraseCurrentSession: () => void;
  resumeSession: (sessionId: string) => void;

  setCurrentTitle: (title: string) => void;
  setCurrentModel: (model: string) => void;
  setCurrentColor: (color: SessionColor) => void;
  setCurrentComment: (comment: string) => void;
  setDefaultDuration: (durationSec: number) => void;
  setDefaultModel: (model: string) => void;

  addSuccess: () => void;
  addFail: () => void;
  addEvent: (anomaly: AnomalyKind) => void;
  undoLastEntry: () => void;

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
      if (prev) finalizeOutgoing(prev);

      const session: EvalSession = {
        id: createId("session"),
        title: "",
        model: state.defaultModel,
        ticketId: null,
        comment: "",
        color: null,
        status: "initial",
        durationSec: state.defaultDurationSec,
        startedAt: now(),
        endedAt: null,
        accumulatedMs: 0,
        runningSince: null,
        entries: [],
      };

      state.sessions.unshift(session);
      state.currentSessionId = session.id;
    }),

  startCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status === "done") return;
      if (!session.runningSince) session.runningSince = now();
      session.status = "active";
    }),

  pauseCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      bank(session);
      session.status = "paused";
    }),

  finishCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      bank(session);
      session.status = "done";
      session.endedAt = now();
    }),

  stopCurrentSession: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session) return;
      bank(session);
      session.status = "stopped";
      session.endedAt = now();
    }),

  eraseCurrentSession: () => {
    const { currentSessionId, sessions } = get();
    if (!currentSessionId) return;
    const index = sessions.findIndex((s) => s.id === currentSessionId);
    if (index === -1) return;
    const banked = cloneSession(sessions[index]);
    if (banked.runningSince) {
      banked.accumulatedMs += Date.now() - Date.parse(banked.runningSince);
      banked.runningSince = null;
    }
    set((state) => {
      state.sessions.splice(index, 1);
      state.currentSessionId = null;
      state.recentlyRemoved = {
        items: [{ session: banked, index, wasCurrent: true }],
        at: Date.now(),
      };
    });
  },

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
      session.entries.push({
        id: createId("entry"),
        kind: "verdict",
        verdict: "success",
        at: now(),
        elapsedMs: elapsedOf(session),
      });
    }),

  addFail: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      session.entries.push({
        id: createId("entry"),
        kind: "verdict",
        verdict: "fail",
        at: now(),
        elapsedMs: elapsedOf(session),
      });
    }),

  addEvent: (anomaly) =>
    set((state) => {
      if (!ANOMALY_KINDS.includes(anomaly)) return;
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || session.status !== "active") return;
      session.entries.push({
        id: createId("entry"),
        kind: "anomaly",
        anomaly,
        at: now(),
        elapsedMs: elapsedOf(session),
      });
    }),

  undoLastEntry: () =>
    set((state) => {
      const session = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (!session || !session.entries.length) return;
      session.entries.pop();
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
      state.sessions = state.sessions.filter(
        (session) => !ids.has(session.id),
      );
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
