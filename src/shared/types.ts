/* ------------------------------------------------------------------ *
 * Domain types — the entity shapes. Features depend on these directly;
 * they never need to import the store to know what a Session is.
 * ------------------------------------------------------------------ */

export type SessionStatus =
  | "initial" // created, never started
  | "active" // clock running
  | "paused" // started then paused
  | "done" // finished (reached target / Finish)
  | "stopped"; // ended early / archived incomplete

export type SessionColor = "red" | "yellow" | "blue";

export type Verdict = "success" | "fail";

export type AnomalyKind =
  | "collision"
  | "dropped"
  | "phantom"
  | "shaky"
  | "random";

/** One ordered timeline entry — a verdict or an anomaly (mirrors legacy `entries`). */
export type SessionEntry =
  | {
      id: string;
      kind: "verdict";
      verdict: Verdict;
      at: string; // ISO timestamp
      elapsedMs: number; // session clock at the moment it was logged
    }
  | {
      id: string;
      kind: "anomaly";
      anomaly: AnomalyKind;
      at: string;
      elapsedMs: number;
    };

export type EvalSession = {
  id: string;
  title: string;
  model: string;
  ticketId: string | null;
  comment: string;
  color: SessionColor | null;
  status: SessionStatus;
  durationSec: number; // target; 0 = unlimited
  startedAt: string; // immutable creation/sort timestamp (ISO)
  endedAt: string | null;
  // clock accounting (wall-clock; survives pause/resume + reload)
  accumulatedMs: number; // time banked from previous runs
  runningSince: string | null; // ISO; set while active, null when paused/stopped
  entries: SessionEntry[];
};

export type Ticket = {
  id: string;
  name: string;
  operators: string[];
  createdAt: string;
};

export type HistoryStatusFilter = "all" | "active" | "done" | "stopped";
export type HistorySort = "newest" | "oldest" | "best" | "worst" | "fastest";
export type HistoryTicketFilter = "all" | "ungrouped" | (string & {});
export type SummaryView = "list" | "chart" | "models";
export type SummaryGraphMetric = "score" | "rate" | "total";
export type ModalName =
  | "renameSession"
  | "ticket"
  | "deleteTicket"
  | "deleteSelected"
  | "erase"
  | "selectionSummary"
  | null;

/** Undo snapshot for deletion / erase (held transiently, not persisted). */
export type RemovedItem = {
  session: EvalSession;
  index: number;
  wasCurrent: boolean;
};
export type RemovedSnapshot = { items: RemovedItem[]; at: number };
