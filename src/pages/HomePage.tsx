import { StopwatchBlock } from "@/features/sessions/components/StopwatchBlock";
import { SessionControls } from "@/features/sessions/components/SessionControls";
import { EvalArea } from "@/features/scoring/components/EvalArea";
import { EventRow } from "@/features/events/components/EventRow";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import styles from "@/app/App.module.css";

export function HomePage() {
  return (
    <main className={styles.main}>
      <StopwatchBlock />
      <SessionControls />
      <EvalArea />
      <EventRow />
      <HistoryPanel />
    </main>
  );
}
