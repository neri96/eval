import type {
  HistoryTicketFilter,
  ModalName,
  RemovedSnapshot,
  SummaryGraphMetric,
  SummaryView,
  TaskId,
} from "@/shared/types";
import { DEFAULT_TASK_ID } from "@/shared/tasks";
import { cloneSession, finalizeOutgoing } from "../helpers";
import type { SliceCreator } from "../evalStore";

/**
 * UI slice — summary view prefs, modal routing, and the undo snapshot.
 * `restoreRemoved` re-inserts removed sessions, reaching into the sessions slice.
 */
export type UiSlice = {
  activeTaskId: TaskId;
  currentTicketId: HistoryTicketFilter | null;
  summaryView: SummaryView;
  summaryGraphMetric: SummaryGraphMetric;
  activeModal: ModalName;
  modalSessionId: string | null;
  ticketModalMode: "create" | "assign";
  recentlyRemoved: RemovedSnapshot | null;

  setActiveTask: (taskId: TaskId) => void;
  setCurrentTicketId: (ticketId: HistoryTicketFilter | null) => void;
  setSummaryView: (view: SummaryView) => void;
  setSummaryGraphMetric: (metric: SummaryGraphMetric) => void;
  openModal: (modal: ModalName, sessionId?: string | null) => void;
  openTicketModal: (mode: "create" | "assign") => void;
  closeModal: () => void;
  restoreRemoved: () => void;
  dismissRemoved: () => void;
};

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  activeTaskId: DEFAULT_TASK_ID,
  currentTicketId: "all",
  summaryView: "list",
  summaryGraphMetric: "score",
  activeModal: null,
  modalSessionId: null,
  ticketModalMode: "create",
  recentlyRemoved: null,

  // Switching the active task re-scopes the whole app to that task. Any
  // in-progress session belongs to the previous task, so finalize it and
  // clear the per-task view state (current session, ticket filter, selection).
  setActiveTask: (taskId) =>
    set((state) => {
      if (state.activeTaskId === taskId) return;
      const current = state.sessions.find(
        (item) => item.id === state.currentSessionId,
      );
      if (current) finalizeOutgoing(current);
      state.activeTaskId = taskId;
      state.currentSessionId = null;
      state.currentTicketId = "all";
      state.historyTicketFilter = "all";
      state.selectedSessionIds = [];
      state.selectMode = false;
    }),

  setCurrentTicketId: (ticketId) =>
    set((state) => {
      state.currentTicketId = ticketId;
    }),

  setSummaryView: (view) =>
    set((state) => {
      state.summaryView = view;
    }),

  setSummaryGraphMetric: (metric) =>
    set((state) => {
      state.summaryGraphMetric = metric;
    }),

  openModal: (modal, sessionId = null) =>
    set((state) => {
      state.activeModal = modal;
      state.modalSessionId = sessionId;
    }),

  openTicketModal: (mode) =>
    set((state) => {
      state.activeModal = "ticket";
      state.ticketModalMode = mode;
    }),

  closeModal: () =>
    set((state) => {
      state.activeModal = null;
      state.modalSessionId = null;
    }),

  restoreRemoved: () => {
    const snapshot = get().recentlyRemoved;
    if (!snapshot) return;

    const items = [...snapshot.items]
      .sort((a, b) => a.index - b.index)
      .map(({ session, index, wasCurrent }) => {
        const restored = cloneSession(session);
        if (wasCurrent) {
          restored.status = "paused";
          restored.endedAt = null;
        }
        return { restored, index, wasCurrent };
      });
    set((state) => {
      for (const { restored, index, wasCurrent } of items) {
        const at = Math.max(0, Math.min(index, state.sessions.length));
        state.sessions.splice(at, 0, restored);
        if (wasCurrent) state.currentSessionId = restored.id;
      }
      state.recentlyRemoved = null;
    });
  },

  dismissRemoved: () =>
    set((state) => {
      state.recentlyRemoved = null;
    }),
});
