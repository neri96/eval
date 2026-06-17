import { useState } from "react";
import type { SessionColor } from "@/shared/types";
import { useEvalStore } from "@/store/evalStore";
import { TransportControls } from "./TransportControls";
import { ColorSelectRow } from "./ColorSelectRow";

/**
 * Coordinates the transport buttons with the new-session color picker:
 * NEW reveals the color row; picking a color creates the session with it.
 */
export function SessionControls() {
  const [colorRowOpen, setColorRowOpen] = useState(false);
  const createNewSession = useEvalStore((state) => state.createNewSession);
  const setCurrentColor = useEvalStore((state) => state.setCurrentColor);

  const pickColor = (color: SessionColor) => {
    createNewSession();
    setCurrentColor(color);
    setColorRowOpen(false);
  };

  return (
    <>
      <TransportControls
        newActive={colorRowOpen}
        onToggleNew={() => setColorRowOpen((open) => !open)}
      />
      <ColorSelectRow
        open={colorRowOpen}
        onPick={pickColor}
        onCancel={() => setColorRowOpen(false)}
      />
    </>
  );
}
