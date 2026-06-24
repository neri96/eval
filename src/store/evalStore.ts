import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { ensureRollouts, normalizeLoadedSession } from "./helpers";
import { DEFAULT_TASK_ID, isTaskId } from "@/shared/tasks";
import {
  createSessionsSlice,
  type SessionsSlice,
} from "./slices/sessionsSlice";
import { createTicketsSlice, type TicketsSlice } from "./slices/ticketsSlice";
import { createHistorySlice, type HistorySlice } from "./slices/historySlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";

export type EvalStore = SessionsSlice & TicketsSlice & HistorySlice & UiSlice;

/** Slice creator pre-bound to this store's middleware (persist + immer). */
export type SliceCreator<TSlice> = StateCreator<
  EvalStore,
  [["zustand/persist", unknown], ["zustand/immer", never]],
  [],
  TSlice
>;

export const useEvalStore = create<EvalStore>()(
  persist(
    immer((...args) => ({
      ...createSessionsSlice(...args),
      ...createTicketsSlice(...args),
      ...createHistorySlice(...args),
      ...createUiSlice(...args),
    })),
    {
      name: "evals-store",
      version: 3,
      // A migrate function is required, otherwise zustand discards persisted
      // state whenever the stored version is older than the one above. The
      // actual shape upgrades (rollouts wrapping, taskId stamping) run
      // defensively in `merge` on every load, so here we simply hand the
      // persisted state through so it survives the version bump.
      migrate: (persisted) => persisted as EvalStore,
      // (migrate must exist so version bumps upgrade rather than discard.)
      // Persist data + preferences only; selection / modals / undo are transient.
      partialize: (state) => ({
        activeTaskId: state.activeTaskId,
        currentSessionId: state.currentSessionId,
        currentTicketId: state.currentTicketId,
        sessions: state.sessions,
        tickets: state.tickets,
        defaultDurationSec: state.defaultDurationSec,
        defaultModel: state.defaultModel,
        historyStatusFilter: state.historyStatusFilter,
        historySearch: state.historySearch,
        historyTicketFilter: state.historyTicketFilter,
        historySort: state.historySort,
        summaryView: state.summaryView,
        summaryGraphMetric: state.summaryGraphMetric,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<EvalStore>;
        const rawSessions = Array.isArray(saved.sessions) ? saved.sessions : [];
        const rawTickets = Array.isArray(saved.tickets) ? saved.tickets : [];
        // v1 → v2: data predating the multi-task model is all cube-in-bowl.
        // v2 → v3: flat sessions are wrapped into a single rollout.
        const sessions = rawSessions.flatMap((raw) => {
          try {
            const normalized = normalizeLoadedSession(ensureRollouts(raw));
            normalized.taskId = normalized.taskId ?? DEFAULT_TASK_ID;
            return [normalized];
          } catch {
            // Skip malformed entries from older/corrupted local state.
            return [];
          }
        });
        const tickets = rawTickets.flatMap((ticket) => {
          try {
            if (!ticket || typeof ticket !== "object") return [];
            const safeTicket = {
              ...ticket,
              taskId: ticket.taskId ?? DEFAULT_TASK_ID,
            };
            return [safeTicket];
          } catch {
            // Skip malformed ticket rows from local state.
            return [];
          }
        });
        const activeTaskId = isTaskId(saved.activeTaskId)
          ? saved.activeTaskId
          : DEFAULT_TASK_ID;
        const ticketIds = new Set(tickets.map((ticket) => ticket.id));
        const migratedCurrentTicketId =
          saved.currentTicketId ?? saved.historyTicketFilter ?? "all";
        const currentTicketId =
          migratedCurrentTicketId &&
          migratedCurrentTicketId !== "all" &&
          migratedCurrentTicketId !== "ungrouped" &&
          !ticketIds.has(migratedCurrentTicketId)
            ? "all"
            : migratedCurrentTicketId;
        // Drop ticket references whose ticket no longer exists (legacy sync).
        sessions.forEach((session) => {
          if (session.ticketId && !ticketIds.has(session.ticketId)) {
            session.ticketId = null;
          }
        });
        return {
          ...current,
          ...saved,
          activeTaskId,
          sessions,
          tickets,
          currentTicketId,
        };
      },
    },
  ),
);

// Dev-only: expose the store for debugging and manual verification.
if (import.meta.env.DEV) {
  (globalThis as { __evalStore?: typeof useEvalStore }).__evalStore =
    useEvalStore;
}
