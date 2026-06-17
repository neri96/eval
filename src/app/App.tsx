import AppHeader from "./AppHeader";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { StopwatchBlock } from "@/features/sessions/components/StopwatchBlock";
import { SessionControls } from "@/features/sessions/components/SessionControls";
import { EvalArea } from "@/features/scoring/components/EvalArea";
import { EventRow } from "@/features/events/components/EventRow";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import { UndoToast } from "@/features/history/components/UndoToast";
import { ModalHost } from "@/features/modals/components/ModalHost";
import styles from "./App.module.css";

function App() {
  useKeyboardShortcuts();

  return (
    <>
      <AppHeader />
      <main className={styles.main}>
        <StopwatchBlock />
        <SessionControls />
        <EvalArea />
        <EventRow />
        <HistoryPanel />
      </main>
      <UndoToast />
      <ModalHost />
    </>
  );
}

export default App;
