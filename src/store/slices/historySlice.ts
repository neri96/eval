import type {
  HistorySort,
  HistoryStatusFilter,
  HistoryTicketFilter,
} from "@/shared/types";
import type { SliceCreator } from "../evalStore";

/**
 * History slice — view state for the session list: filters, sort, search,
 * and multi-select. Pure UI state; the actual list lives in the sessions slice.
 */
export type HistorySlice = {
  historyStatusFilter: HistoryStatusFilter;
  historySearch: string;
  historyTicketFilter: HistoryTicketFilter;
  historySort: HistorySort;
  selectMode: boolean;
  selectedSessionIds: string[];

  setHistoryStatusFilter: (filter: HistoryStatusFilter) => void;
  setHistorySearch: (value: string) => void;
  setHistoryTicketFilter: (ticketId: HistoryTicketFilter) => void;
  setHistorySort: (sort: HistorySort) => void;
  toggleSelectMode: () => void;
  toggleSessionSelected: (sessionId: string) => void;
  selectSessions: (sessionIds: string[]) => void;
  clearSelection: () => void;
};

export const createHistorySlice: SliceCreator<HistorySlice> = (set) => ({
  historyStatusFilter: "all",
  historySearch: "",
  historyTicketFilter: "all",
  historySort: "newest",
  selectMode: false,
  selectedSessionIds: [],

  setHistoryStatusFilter: (filter) =>
    set((state) => {
      state.historyStatusFilter = filter;
    }),

  setHistorySearch: (value) =>
    set((state) => {
      state.historySearch = value;
    }),

  setHistoryTicketFilter: (ticketId) =>
    set((state) => {
      state.historyTicketFilter = ticketId;
    }),

  setHistorySort: (sort) =>
    set((state) => {
      state.historySort = sort;
    }),

  toggleSelectMode: () =>
    set((state) => {
      state.selectMode = !state.selectMode;
      if (!state.selectMode) state.selectedSessionIds = [];
    }),

  toggleSessionSelected: (sessionId) =>
    set((state) => {
      const index = state.selectedSessionIds.indexOf(sessionId);
      if (index >= 0) state.selectedSessionIds.splice(index, 1);
      else state.selectedSessionIds.push(sessionId);
    }),

  selectSessions: (sessionIds) =>
    set((state) => {
      state.selectedSessionIds = sessionIds;
      if (sessionIds.length) state.selectMode = true;
    }),

  clearSelection: () =>
    set((state) => {
      state.selectedSessionIds = [];
    }),
});
