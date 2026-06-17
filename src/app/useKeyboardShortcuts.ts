import { useEffect } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { EVENT_TYPES } from "@/shared/constants";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Global keyboard shortcuts (legacy keydown handler):
 *   → success · ← fail · c/d/p/s/r anomaly events · ⌘/Ctrl+Z undo removal.
 * Ignored while typing in a form field (so native undo still works there).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && EDITABLE_TAGS.has(active.tagName)) return;

      const state = useEvalStore.getState();
      const current = selectCurrentSession(state);
      const isActive = current?.status === "active";

      if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
        const eventType = EVENT_TYPES.find(
          (type) => type.key === event.key.toLowerCase(),
        );
        if (eventType) {
          if (isActive) {
            event.preventDefault();
            state.addEvent(eventType.id);
          }
          return;
        }
      }

      if (event.key === "ArrowRight" && isActive) {
        event.preventDefault();
        state.addSuccess();
      } else if (event.key === "ArrowLeft" && isActive) {
        event.preventDefault();
        state.addFail();
      } else if (
        (event.key === "z" || event.key === "Z") &&
        (event.metaKey || event.ctrlKey) &&
        state.recentlyRemoved
      ) {
        event.preventDefault();
        state.restoreRemoved();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
