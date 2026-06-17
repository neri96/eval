import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { normalizeLoadedSession } from "./helpers";
import { createSessionsSlice, type SessionsSlice } from "./slices/sessionsSlice";
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
      version: 1,
      // Persist data + preferences only; selection / modals / undo are transient.
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
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
        const sessions = (saved.sessions ?? []).map(normalizeLoadedSession);
        const tickets = saved.tickets ?? [];
        const ticketIds = new Set(tickets.map((ticket) => ticket.id));
        // Drop ticket references whose ticket no longer exists (legacy sync).
        sessions.forEach((session) => {
          if (session.ticketId && !ticketIds.has(session.ticketId)) {
            session.ticketId = null;
          }
        });
        return { ...current, ...saved, sessions, tickets };
      },
    },
  ),
);
