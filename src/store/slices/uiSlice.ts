import type {
  ModalName,
  RemovedSnapshot,
  SummaryGraphMetric,
  SummaryView,
} from "@/shared/types";
import { cloneSession } from "../helpers";
import type { SliceCreator } from "../evalStore";

/**
 * UI slice — summary view prefs, modal routing, and the undo snapshot.
 * `restoreRemoved` re-inserts removed sessions, reaching into the sessions slice.
 */
export type UiSlice = {
  summaryView: SummaryView;
  summaryGraphMetric: SummaryGraphMetric;
  activeModal: ModalName;
  modalSessionId: string | null;
  ticketModalMode: "create" | "assign";
  recentlyRemoved: RemovedSnapshot | null;

  setSummaryView: (view: SummaryView) => void;
  setSummaryGraphMetric: (metric: SummaryGraphMetric) => void;
  openModal: (modal: ModalName, sessionId?: string | null) => void;
  openTicketModal: (mode: "create" | "assign") => void;
  closeModal: () => void;
  restoreRemoved: () => void;
  dismissRemoved: () => void;
};

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  summaryView: "list",
  summaryGraphMetric: "score",
  activeModal: null,
  modalSessionId: null,
  ticketModalMode: "create",
  recentlyRemoved: null,

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
    // Clone outside the recipe — `session` is a plain finalized object here,
    // not an immer draft Proxy (structuredClone throws on Proxies).
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
