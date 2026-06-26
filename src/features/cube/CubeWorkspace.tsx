import { StopwatchBlock } from "@/features/sessions/components/StopwatchBlock";
import { SessionMeta } from "../sessions/components/SessionMeta";
import { SessionMode } from "../sessions/components/SessionMode";
import { SessionControls } from "@/features/sessions/components/SessionControls";
import { EvalGrid } from "@/features/scoring/components/EvalGrid";
import { EvalArea } from "@/features/scoring/components/EvalArea";
import { EventRow } from "@/features/events/components/EventRow";
import { VoiceControls } from "@/features/voice/VoiceControls";
import { LiveEntryFeed } from "@/features/scoring/components/LiveEntryFeed";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";

export function CubeWorkspace() {
  return (
    <>
      <StopwatchBlock />
      <SessionMode />
      <SessionMeta />
      <SessionControls />
      <EvalGrid />
      <EvalArea />
      <EventRow />
      <VoiceControls />
      <LiveEntryFeed />
      <HistoryPanel />
    </>
  );
}
