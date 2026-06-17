import type { Ticket } from "@/shared/types";
import { createId, normalizeOperators, now } from "../helpers";
import type { SliceCreator } from "../evalStore";

/**
 * Tickets slice — ticket entities and their actions. `assignSessionsToTicket`
 * writes session.ticketId and `deleteTicket` resets the history ticket filter,
 * both via the shared store draft.
 */
export type TicketsSlice = {
  tickets: Ticket[];

  createTicket: (name: string, operators?: string[]) => string | null;
  assignSessionsToTicket: (
    sessionIds: string[],
    ticketId: string | null,
  ) => void;
  updateTicketOperators: (ticketId: string, operators: string[]) => void;
  deleteTicket: (ticketId: string) => void;
};

export const createTicketsSlice: SliceCreator<TicketsSlice> = (set) => ({
  tickets: [],

  createTicket: (name, operators = []) => {
    let ticketId: string | null = null;
    set((state) => {
      const cleaned = name.trim();
      if (!cleaned) return;
      const ops = normalizeOperators(operators);
      const existing = state.tickets.find(
        (ticket) => ticket.name.toLowerCase() === cleaned.toLowerCase(),
      );
      if (existing) {
        existing.operators = ops;
        ticketId = existing.id;
      } else {
        ticketId = createId("ticket");
        state.tickets.push({
          id: ticketId,
          name: cleaned,
          operators: ops,
          createdAt: now(),
        });
      }
      state.tickets.sort((a, b) => a.name.localeCompare(b.name));
    });
    return ticketId;
  },

  assignSessionsToTicket: (sessionIds, ticketId) =>
    set((state) => {
      const target = ticketId || null;
      const ids = new Set(sessionIds);
      state.sessions.forEach((session) => {
        if (ids.has(session.id)) session.ticketId = target;
      });
    }),

  updateTicketOperators: (ticketId, operators) =>
    set((state) => {
      const ticket = state.tickets.find((item) => item.id === ticketId);
      if (ticket) ticket.operators = normalizeOperators(operators);
    }),

  deleteTicket: (ticketId) =>
    set((state) => {
      // Legacy guard: only empty tickets can be deleted.
      const inUse = state.sessions.some(
        (session) => session.ticketId === ticketId,
      );
      if (inUse) return;
      state.tickets = state.tickets.filter((ticket) => ticket.id !== ticketId);
      if (state.historyTicketFilter === ticketId) {
        state.historyTicketFilter = "all";
      }
    }),
});
