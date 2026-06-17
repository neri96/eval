import { useShallow } from "zustand/react/shallow";
import { useEvalStore } from "@/store/evalStore";
import { selectFilteredSessions } from "@/store/selectors";
import { HistoryControls } from "./HistoryControls";
import { SessionCard } from "./SessionCard";
import styles from "./HistoryPanel.module.css";

export function HistoryPanel() {
  const sessions = useEvalStore(useShallow(selectFilteredSessions));
  const totalSessions = useEvalStore((state) => state.sessions.length);

  return (
    <section>
      <HistoryControls />
      <div className={styles.list}>
        {sessions.length === 0 ? (
          <div className={styles.empty}>
            {totalSessions
              ? "NO SESSIONS MATCH THIS FILTER"
              : "NO SESSIONS YET"}
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))
        )}
      </div>
    </section>
  );
}
