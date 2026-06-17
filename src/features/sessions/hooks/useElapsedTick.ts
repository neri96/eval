import { useEffect, useReducer } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession, selectShouldAutoFinish } from "@/store/selectors";

/**
 * Drives the live clock. The store can't own a `setInterval`, so this hook
 * re-renders its host each tick while a session is running, and auto-finishes
 * when the target duration is reached (legacy completeSession-on-timeout).
 */
export function useElapsedTick(intervalMs = 250) {
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const id = setInterval(() => {
      const state = useEvalStore.getState();
      const current = selectCurrentSession(state);
      if (current?.status !== "active") return;
      if (selectShouldAutoFinish(state)) {
        state.finishCurrentSession();
      } else {
        forceRender();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
