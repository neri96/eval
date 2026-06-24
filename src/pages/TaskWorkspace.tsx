import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { StopwatchBlock } from "@/features/sessions/components/StopwatchBlock";
import { SessionControls } from "@/features/sessions/components/SessionControls";
import { EvalArea } from "@/features/scoring/components/EvalArea";
import { EventRow } from "@/features/events/components/EventRow";
import { VoiceControls } from "@/features/voice/VoiceControls";
import { LiveEntryFeed } from "@/features/scoring/components/LiveEntryFeed";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import { LegoWorkspace } from "@/features/lego/components/LegoWorkspace";

import { useEvalStore } from "@/store/evalStore";
import { getTask, isTaskId } from "@/shared/tasks";

import styles from "@/app/App.module.css";

/**
 * The scoring workspace for a single task. The route param is the source of
 * truth for which task is active; deep links and refreshes re-sync the store.
 * Unknown or not-yet-available tasks bounce back to the launcher.
 */
export function TaskWorkspace() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const setActiveTask = useEvalStore((state) => state.setActiveTask);

  const valid = isTaskId(taskId) && getTask(taskId).available;

  useEffect(() => {
    if (isTaskId(taskId) && getTask(taskId).available) {
      setActiveTask(taskId);
    } else {
      navigate("/", { replace: true });
    }
  }, [taskId, navigate, setActiveTask]);

  if (!valid) return null;

  const multiRollout =
    isTaskId(taskId) && getTask(taskId).kind === "multi-rollout";

  return (
    <main className={styles.main}>
      {multiRollout ? (
        <LegoWorkspace />
      ) : (
        <>
          <StopwatchBlock />
          <SessionControls />
          <EvalArea />
          <EventRow />
          <VoiceControls />
          <LiveEntryFeed />
          <HistoryPanel />
        </>
      )}
    </main>
  );
}
