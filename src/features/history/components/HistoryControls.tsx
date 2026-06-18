import { useMemo } from "react";
import type { HistorySort, HistoryStatusFilter } from "@/shared/types";
import { useEvalStore } from "@/store/evalStore";
import { historyCounts, selectFilteredSessions } from "@/store/selectors";
import { exportCsv, exportJson } from "@/features/history/export";
import styles from "./HistoryControls.module.css";

const TABS: { id: HistoryStatusFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "active", label: "ACTIVE" },
  { id: "done", label: "DONE" },
  { id: "stopped", label: "STOPPED" },
];

const SORTS: { id: HistorySort; label: string }[] = [
  { id: "newest", label: "RECENT FIRST" },
  { id: "oldest", label: "OLDEST FIRST" },
  { id: "best", label: "HIGHEST QUALITY (CONFIDENCE)" },
  { id: "worst", label: "HIGHEST RISK (CONFIDENCE)" },
  { id: "fastest", label: "HIGHEST THROUGHPUT" },
];

export function HistoryControls() {
  const sessions = useEvalStore((state) => state.sessions);
  const tickets = useEvalStore((state) => state.tickets);
  const statusFilter = useEvalStore((state) => state.historyStatusFilter);
  const search = useEvalStore((state) => state.historySearch);
  const ticketFilter = useEvalStore((state) => state.currentTicketId ?? "all");
  const sort = useEvalStore((state) => state.historySort);
  const setHistoryStatusFilter = useEvalStore(
    (state) => state.setHistoryStatusFilter,
  );
  const setHistorySearch = useEvalStore((state) => state.setHistorySearch);
  const setCurrentTicketId = useEvalStore((state) => state.setCurrentTicketId);
  const setHistorySort = useEvalStore((state) => state.setHistorySort);
  const selectMode = useEvalStore((state) => state.selectMode);
  const selectedCount = useEvalStore(
    (state) => state.selectedSessionIds.length,
  );
  const visibleCount = useEvalStore(
    (state) => selectFilteredSessions(state).length,
  );
  const toggleSelectMode = useEvalStore((state) => state.toggleSelectMode);
  const selectSessions = useEvalStore((state) => state.selectSessions);
  const clearSelection = useEvalStore((state) => state.clearSelection);
  const openModal = useEvalStore((state) => state.openModal);
  const openTicketModal = useEvalStore((state) => state.openTicketModal);

  const counts = useMemo(() => historyCounts(sessions), [sessions]);

  const selectVisible = () =>
    selectSessions(
      selectFilteredSessions(useEvalStore.getState()).map(
        (session) => session.id,
      ),
    );

  const exportSessions = (kind: "csv" | "json") => {
    const state = useEvalStore.getState();
    const targets = state.selectedSessionIds.length
      ? state.sessions.filter((session) =>
          state.selectedSessionIds.includes(session.id),
        )
      : selectFilteredSessions(state);
    if (kind === "csv") exportCsv(targets, state.tickets);
    else exportJson(targets, state.tickets);
  };

  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionTitle}>Session History</span>
      <div className={styles.controls}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${statusFilter === tab.id ? styles.active : ""}`}
              onClick={() => setHistoryStatusFilter(tab.id)}
            >
              {tab.label} <span className={styles.count}>{counts[tab.id]}</span>
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <input
            className={styles.search}
            type="text"
            placeholder="SEARCH TITLE OR MODEL"
            autoComplete="off"
            maxLength={80}
            value={search}
            onChange={(event) => setHistorySearch(event.target.value)}
          />
          <select
            className={styles.select}
            value={ticketFilter}
            onChange={(event) => setCurrentTicketId(event.target.value)}
          >
            <option value="all">ALL TICKETS</option>
            <option value="ungrouped">NO TICKET</option>
            {tickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={sort}
            onChange={(event) =>
              setHistorySort(event.target.value as HistorySort)
            }
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actionsBottom}>
          <button
            type="button"
            className={`${styles.utilityBtn} ${selectMode ? styles.active : ""}`}
            onClick={toggleSelectMode}
          >
            {selectMode ? `SELECTING ${selectedCount}` : "SELECT"}
          </button>
          <button
            type="button"
            className={styles.utilityBtn}
            disabled={!selectMode || !visibleCount}
            onClick={selectVisible}
          >
            ALL VISIBLE
          </button>
          <button
            type="button"
            className={styles.utilityBtn}
            disabled={!selectedCount}
            onClick={clearSelection}
          >
            CLEAR
          </button>
          <button
            type="button"
            className={styles.utilityBtn}
            disabled={!selectedCount}
            onClick={() => openTicketModal("assign")}
          >
            ADD TO TICKET
          </button>
          <button
            type="button"
            className={styles.utilityBtn}
            disabled={!selectedCount && !visibleCount}
            onClick={() => openModal("selectionSummary")}
          >
            SUMMARIZE
          </button>
          <button
            type="button"
            className={`${styles.utilityBtn} ${styles.danger}`}
            disabled={!selectedCount}
            onClick={() => openModal("deleteSelected")}
          >
            DELETE SELECTED
          </button>
          <button
            type="button"
            className={`${styles.utilityBtn} ${styles.danger}`}
            onClick={() => openModal("deleteTicket")}
          >
            DELETE TICKET
          </button>
          <button
            type="button"
            className={styles.exportBtn}
            disabled={!selectedCount && !visibleCount}
            onClick={() => exportSessions("csv")}
          >
            CSV
          </button>
          <button
            type="button"
            className={styles.exportBtn}
            disabled={!selectedCount && !visibleCount}
            onClick={() => exportSessions("json")}
          >
            JSON
          </button>
        </div>
      </div>
    </div>
  );
}
