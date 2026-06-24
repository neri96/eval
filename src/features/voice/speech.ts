export type SpeechResult = { transcript: string; isFinal: boolean };

type ResultHandler = (result: SpeechResult) => void;
type StateHandler = (listening: boolean) => void;
type ErrorHandler = (error: string) => void;

export const VOICE_CAPTURE_REQUESTED_EVENT =
  "generalist:voice-capture-requested";

// Minimal structural types (the DOM lib types vary by TS config).
type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export class SpeechController {
  private rec: RecognitionLike | null = null;
  private active = false;
  private onResult: ResultHandler | null = null;
  private onState: StateHandler | null = null;
  private onError: ErrorHandler | null = null;

  constructor() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const results = event.results;
      const last = results[results.length - 1];
      if (!last) return;
      this.onResult?.({
        transcript: last[0].transcript,
        isFinal: last.isFinal,
      });
    };
    rec.onend = () => {
      // Chrome stops on silence even when continuous — restart while active.
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      } else {
        this.onState?.(false);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.onError?.(event.error);
    };
    this.rec = rec;
  }

  setHandlers(
    onResult: ResultHandler,
    onState: StateHandler,
    onError: ErrorHandler,
  ) {
    this.onResult = onResult;
    this.onState = onState;
    this.onError = onError;
  }

  start() {
    if (!this.rec || this.active) return;
    this.active = true;
    try {
      this.rec.start();
      this.onState?.(true);
    } catch {
      /* start() throws if already started — safe to ignore */
    }
  }

  stop() {
    if (!this.rec) return;
    this.active = false;
    try {
      this.rec.stop();
    } catch {
      /* not running */
    }
  }

  /** Dev/test hook: push a transcript through as if the mic produced it. */
  simulate(transcript: string, isFinal = true) {
    this.onResult?.({ transcript, isFinal });
  }
}
