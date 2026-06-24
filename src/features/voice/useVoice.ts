import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEvalStore } from "@/store/evalStore";
import type { EventId } from "@/shared/types";
import {
  buildEventVocab,
  buildVerdictVocab,
  matchCommand,
  matchVerdicts,
  type Vocab,
} from "./matching";
import {
  isSpeechSupported,
  SpeechController,
  VOICE_CAPTURE_REQUESTED_EVENT,
} from "./speech";

export type VoiceFeedback = { ok: boolean; text: string };

/**
 * Voice control: a continuous toggle for verdicts (placed/failed fire
 * constantly) and push-to-talk for the occasional event. One recognition
 * stream; the active mode decides which hard-coded vocabulary we match and
 * whether a no-match asks to repeat (events) or is ignored (verdicts).
 */
export function useVoice() {
  const supported = useMemo(() => isSpeechSupported(), []);
  const activeTaskId = useEvalStore((state) => state.activeTaskId);

  const [verdictOn, setVerdictOn] = useState(false);
  const [pttHeld, setPttHeld] = useState(false);
  const [interim, setInterim] = useState("");
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);

  const controllerRef = useRef<SpeechController | null>(null);
  const pttRef = useRef(false);
  const verdictRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const vocabRef = useRef<{ events: Vocab; verdicts: Vocab }>({
    events: [],
    verdicts: [],
  });
  const feedbackTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    pttRef.current = pttHeld;
  }, [pttHeld]);
  useEffect(() => {
    verdictRef.current = verdictOn;
  }, [verdictOn]);
  useEffect(() => {
    vocabRef.current = {
      events: buildEventVocab(activeTaskId),
      verdicts: buildVerdictVocab(activeTaskId),
    };
  }, [activeTaskId]);

  useEffect(() => {
    if (!supported) return;
    const releaseVoiceCapture = () => {
      setVerdictOn(false);
      setPttHeld(false);
      setInterim("");
      controllerRef.current?.stop();
    };
    window.addEventListener(
      VOICE_CAPTURE_REQUESTED_EVENT,
      releaseVoiceCapture,
    );
    return () => {
      window.removeEventListener(
        VOICE_CAPTURE_REQUESTED_EVENT,
        releaseVoiceCapture,
      );
    };
  }, [supported]);

  const flash = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1900);
  }, []);

  const sessionActive = () =>
    useEvalStore.getState().getCurrentSession()?.status === "active";

  // Set up one recognition controller.
  useEffect(() => {
    if (!supported) return;
    const controller = new SpeechController();
    controller.setHandlers(
      (result) => {
        lastTranscriptRef.current = result.transcript;
        if (pttRef.current) {
          setInterim(result.transcript);
          return;
        }
        if (verdictRef.current && result.isFinal) {
          setInterim("");
          if (!sessionActive()) return;
          const ids = matchVerdicts(result.transcript, vocabRef.current.verdicts);
          const store = useEvalStore.getState();
          let logged = 0;
          for (const id of ids) {
            if (id === "success") store.addSuccess();
            else if (id === "fail") store.addFail();
            else if (id === "bad_grasp") store.addEvent("bad_grasp");
            logged += 1;
          }
          if (logged) flash(true, `✓ ${logged} verdict${logged > 1 ? "s" : ""}`);
        }
      },
      () => {},
      (error) => {
        if (error === "not-allowed" || error === "service-not-allowed") {
          setVerdictOn(false);
          setPttHeld(false);
          flash(false, "Mic permission needed");
        }
      },
    );
    controllerRef.current = controller;

    return () => controller.stop();
  }, [supported, flash]);

  // Listen whenever either mode is engaged.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (verdictOn || pttHeld) controller.start();
    else controller.stop();
  }, [verdictOn, pttHeld]);

  const startPtt = useCallback(() => {
    if (!supported) return;
    if (!sessionActive()) {
      flash(false, "Start a rollout first");
      return;
    }
    lastTranscriptRef.current = "";
    setInterim("");
    setPttHeld(true);
  }, [supported, flash]);

  const endPtt = useCallback(() => {
    if (!pttRef.current) return;
    setPttHeld(false);
    setInterim("");
    const transcript = lastTranscriptRef.current.trim();
    const match = transcript
      ? matchCommand(transcript, vocabRef.current.events)
      : null;
    if (!match) {
      flash(false, transcript ? `“${transcript}” — say again` : "Didn't catch that");
      return;
    }
    if (!sessionActive()) {
      flash(false, "Start a rollout first");
      return;
    }
    useEvalStore.getState().addEvent(match.id as EventId);
    flash(true, `✓ ${match.label}`);
  }, [flash]);

  const toggleVerdict = useCallback(() => setVerdictOn((v) => !v), []);

  // Dev/test hook: drive the full pipeline without a microphone.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (globalThis as { __voice?: unknown }).__voice = {
      sim: (t: string, isFinal = true) => controllerRef.current?.simulate(t, isFinal),
      startPtt,
      endPtt,
      toggleVerdict,
      // pure matchers against the active task's vocabulary
      match: (t: string) => matchCommand(t, vocabRef.current.events),
      matchV: (t: string) => matchVerdicts(t, vocabRef.current.verdicts),
    };
  }, [startPtt, endPtt, toggleVerdict]);

  return {
    supported,
    verdictOn,
    toggleVerdict,
    pttHeld,
    startPtt,
    endPtt,
    interim,
    feedback,
  };
}
