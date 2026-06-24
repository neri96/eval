import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EvalSession, SessionEntry } from "@/shared/types";
import { COMMENT_MAX } from "@/shared/constants";
import { getTask } from "@/shared/tasks";
import { useEvalStore } from "@/store/evalStore";
import {
  getSessionMetrics,
  selectTickets,
  sessionStatusGroup,
} from "@/store/selectors";
import { getLegoMetrics } from "@/features/history/summary";
import { sessionEntries } from "@/store/helpers";
import { formatClock, formatDateLabel } from "@/shared/utils/time";
import {
  toEnglishFromSpeech,
  type SpeechLang,
} from "@/features/voice/translate";
import { VOICE_CAPTURE_REQUESTED_EVENT } from "@/features/voice/speech";
import styles from "./SessionCard.module.css";

const STATUS_LABEL = {
  active: "ACTIVE",
  done: "DONE",
  stopped: "STOPPED",
} as const;

const SPEECH_LANG_MAP: Record<SpeechLang, string> = {
  en: "en-US",
  es: "es-ES",
  ru: "ru-RU",
};

const SPEECH_LABEL_MAP: Record<SpeechLang, string> = {
  en: "EN",
  es: "ES",
  ru: "RU",
};

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
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

function appendSentence(base: string, addition: string): string {
  if (!addition) return base;
  const trimmedBase = base.trim();
  if (!trimmedBase) return addition;
  return `${trimmedBase} ${addition}`;
}

function scoreClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 70) return styles.scoreGood;
  if (score >= 40) return styles.scoreMid;
  return styles.scoreBad;
}

function EntryList({ session }: { session: EvalSession }) {
  const deleteEntry = useEvalStore((state) => state.deleteEntry);
  // Number verdict entries (skipping anomalies) before render.
  const rows: { entry: SessionEntry; verdictNumber: number | null }[] = [];
  let verdictCount = 0;
  for (const entry of sessionEntries(session)) {
    if (entry.kind === "verdict") {
      verdictCount += 1;
      rows.push({ entry, verdictNumber: verdictCount });
    } else {
      rows.push({ entry, verdictNumber: null });
    }
  }

  return (
    <>
      {rows.map(({ entry, verdictNumber }) => {
        const ts = formatClock(entry.elapsedMs / 1000);
        if (entry.kind === "anomaly") {
          const meta = getTask(session.taskId).events.find(
            (def) => def.id === entry.anomaly,
          );
          return (
            <div
              key={entry.id}
              className={`${styles.entryRow} ${styles.ev} ${styles[entry.anomaly]}`}
            >
              <span className={styles.entryBadge}>
                {meta?.label ?? entry.anomaly}
              </span>
              <span className={styles.entryTs}>@ {ts}</span>
              <span className={styles.entryKind}>EVENT</span>
              <button
                type="button"
                className={styles.entryDel}
                title="Delete entry"
                aria-label="Delete entry"
                onClick={() => deleteEntry(session.id, entry.id)}
              >
                ×
              </button>
            </div>
          );
        }
        return (
          <div
            key={entry.id}
            className={`${styles.entryRow} ${entry.verdict === "success" ? styles.s : styles.f}`}
          >
            <span className={styles.entryBadge}>
              {entry.verdict === "success" ? "PASS" : "FAIL"}
            </span>
            <span className={styles.entryTs}>@ {ts}</span>
            <span className={styles.entryKind}>#{verdictNumber}</span>
            <button
              type="button"
              className={styles.entryDel}
              title="Delete entry"
              aria-label="Delete entry"
              onClick={() => deleteEntry(session.id, entry.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </>
  );
}

export function SessionCard({ session }: { session: EvalSession }) {
  const [expanded, setExpanded] = useState(false);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [dictationLang, setDictationLang] = useState<SpeechLang>("en");
  const [dictating, setDictating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [interimDictation, setInterimDictation] = useState("");
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const currentSessionId = useEvalStore((state) => state.currentSessionId);
  const tickets = useEvalStore(useShallow(selectTickets));
  const selectMode = useEvalStore((state) => state.selectMode);
  const selectedSessionIds = useEvalStore((state) => state.selectedSessionIds);
  const historySort = useEvalStore((state) => state.historySort);
  const resumeSession = useEvalStore((state) => state.resumeSession);
  const deleteSessions = useEvalStore((state) => state.deleteSessions);
  const openModal = useEvalStore((state) => state.openModal);
  const assignSessionsToTicket = useEvalStore(
    (state) => state.assignSessionsToTicket,
  );
  const setSessionComment = useEvalStore((state) => state.setSessionComment);
  const toggleSessionSelected = useEvalStore(
    (state) => state.toggleSessionSelected,
  );
  const dictationOwner = `comment:${session.id}`;
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const shouldDictateRef = useRef(false);
  const restartTimerRef = useRef<number | undefined>(undefined);
  const translateQueueRef = useRef(Promise.resolve());
  const speechSupported = getRecognitionCtor() !== null;

  const group = sessionStatusGroup(session);
  const metrics = getSessionMetrics(session);
  const task = getTask(session.taskId);
  const isLego = task.kind === "multi-rollout";
  const legoMetrics = isLego ? getLegoMetrics(session) : null;
  const isLiveCurrent = session.id === currentSessionId && group === "active";
  const ticket = tickets.find((item) => item.id === session.ticketId) ?? null;
  const selected = selectedSessionIds.includes(session.id);
  const label = session.title || formatDateLabel(session.startedAt);
  const cardClass =
    group === "active"
      ? styles.activeCard
      : group === "done"
        ? styles.completed
        : styles.incomplete;

  const rank = isLego
    ? legoMetrics!.secPerPiece === null
      ? "— S/PC"
      : `${legoMetrics!.secPerPiece.toFixed(1)} S/PC`
    : metrics.total
      ? historySort === "worst"
        ? `RISK ${(metrics.riskConfidence * 100).toFixed(1)}%`
        : `QUALITY ${(metrics.qualityConfidence * 100).toFixed(1)}%`
      : historySort === "worst"
        ? "RISK —"
        : "QUALITY —";

  // Meta-line dots show the event profile only — bad grasps + glitches are
  // surfaced in the expanded metrics row, not here.

  const eventChips = task.events.filter(
    (def) =>
      !def.primary && !def.endsRollout && (metrics.events[def.id] ?? 0) > 0,
  );
  const operatorList =
    ticket && ticket.operators.length ? ticket.operators.join(", ") : null;

  const appendCommentText = useCallback(
    (text: string) => {
      const latestSession = useEvalStore
        .getState()
        .sessions.find((item) => item.id === session.id);
      const existing = latestSession?.comment ?? "";
      setSessionComment(session.id, appendSentence(existing, text));
    },
    [session.id, setSessionComment],
  );

  const enqueueTranscript = useCallback(
    (rawTranscript: string) => {
      const transcript = rawTranscript.trim();
      if (!transcript) return;

      translateQueueRef.current = translateQueueRef.current
        .then(async () => {
          setTranslating(true);
          if (dictationLang === "en") {
            appendCommentText(transcript);
            setDictationStatus("Added English speech");
            return;
          }

          const translated = await toEnglishFromSpeech(
            transcript,
            dictationLang,
          );
          appendCommentText(translated);
          setDictationStatus(`Added ${SPEECH_LABEL_MAP[dictationLang]} → EN`);
        })
        .catch(() => {
          setDictationStatus("Speech processing failed");
        })
        .finally(() => {
          setTranslating(false);
        });
    },
    [appendCommentText, dictationLang],
  );

  const stopDictation = useCallback(() => {
    const rec = recognitionRef.current;
    shouldDictateRef.current = false;
    window.clearTimeout(restartTimerRef.current);
    if (!rec) return;
    recognitionRef.current = null;
    setDictating(false);
    setInterimDictation("");
    try {
      rec.stop();
    } catch {
      /* ignore stop failures */
    }
  }, []);

  const startDictation = useCallback(() => {
    if (!speechSupported || dictating) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setDictationStatus("Mic unavailable in this browser");
      return;
    }

    window.dispatchEvent(
      new CustomEvent(VOICE_CAPTURE_REQUESTED_EVENT, {
        detail: { owner: dictationOwner },
      }),
    );
    window.clearTimeout(restartTimerRef.current);
    shouldDictateRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = SPEECH_LANG_MAP[dictationLang];

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript?.trim();
        if (!chunk) continue;
        if (event.results[i].isFinal) {
          enqueueTranscript(chunk);
        } else {
          interim = `${interim} ${chunk}`.trim();
        }
      }
      setInterimDictation(interim);
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        shouldDictateRef.current = false;
        setDictationStatus("Mic permission denied");
      } else {
        setDictationStatus(`Mic error: ${event.error}`);
      }
      stopDictation();
    };

    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      setInterimDictation("");

      if (shouldDictateRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          if (recognitionRef.current !== rec || !shouldDictateRef.current) {
            return;
          }
          try {
            rec.start();
            setDictating(true);
          } catch {
            shouldDictateRef.current = false;
            recognitionRef.current = null;
            setDictating(false);
            setDictationStatus("Mic stopped");
          }
        }, 150);
      } else {
        recognitionRef.current = null;
        setDictating(false);
      }
    };

    recognitionRef.current = rec;
    setDictationStatus(
      dictationLang === "en"
        ? "Listening in English"
        : `Listening in ${SPEECH_LABEL_MAP[dictationLang]} and translating to EN`,
    );
    try {
      rec.start();
      setDictating(true);
    } catch {
      shouldDictateRef.current = false;
      setDictationStatus("Unable to start mic");
      recognitionRef.current = null;
      setDictating(false);
    }
  }, [
    dictating,
    dictationLang,
    dictationOwner,
    enqueueTranscript,
    speechSupported,
    stopDictation,
  ]);

  useEffect(() => {
    const handleVoiceCapture = (event: Event) => {
      const owner = (event as CustomEvent<{ owner?: string }>).detail?.owner;
      if (owner !== dictationOwner) stopDictation();
    };
    window.addEventListener(VOICE_CAPTURE_REQUESTED_EVENT, handleVoiceCapture);
    return () => {
      const rec = recognitionRef.current;
      shouldDictateRef.current = false;
      window.clearTimeout(restartTimerRef.current);
      window.removeEventListener(
        VOICE_CAPTURE_REQUESTED_EVENT,
        handleVoiceCapture,
      );
      if (!rec) return;
      try {
        rec.stop();
      } catch {
        /* ignore stop failures */
      }
    };
  }, [dictationOwner, stopDictation]);

  return (
    <div
      className={`${styles.card} ${cardClass} ${expanded ? styles.expanded : ""} ${
        selectMode ? styles.selectMode : ""
      }`}
    >
      <div className={styles.head} onClick={() => setExpanded((open) => !open)}>
        {selectMode && (
          <label
            className={styles.selectWrap}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              className={styles.select}
              checked={selected}
              onChange={() => toggleSessionSelected(session.id)}
            />
          </label>
        )}
        <div className={styles.statusDot} />

        <div className={styles.metaInner}>
          <span className={styles.num}>
            {STATUS_LABEL[group]} ·{" "}
            <span className={styles.primaryLabel}>{label}</span>
          </span>
          {session.model && (
            <span className={styles.modelTag}>{session.model}</span>
          )}
          {session.color && (
            <span
              className={`${styles.colorTag} ${styles[session.color]} ${styles.hoverableTag}`}
              title={`Color: ${session.color.toUpperCase()}`}
            >
              ● {session.color.toUpperCase()}
            </span>
          )}
          {ticket && (
            <span
              className={styles.ticketTag}
              title={
                ticket.operators.length
                  ? `OPERATORS: ${ticket.operators.join(", ")}`
                  : "NO OPERATORS"
              }
            >
              {ticket.name}
            </span>
          )}
          {session.comment && (
            <span className={styles.commentTag}>COMMENT</span>
          )}
          <span className={styles.timeTag}>
            {formatClock(metrics.elapsedMs / 1000)}
          </span>
          <span className={styles.rankTag}>{rank}</span>
          <div className={styles.quickStats}>
            {isLego ? (
              <>
                <span className={styles.qsS}>{legoMetrics!.placed} placed</span>
                <span className={styles.qsF}>{legoMetrics!.failed} failed</span>
                <span className={styles.scoreTag}>
                  R{legoMetrics!.rollouts}
                  {legoMetrics!.glitchedRollouts > 0
                    ? ` · ${legoMetrics!.glitchedRollouts}⚡`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <span className={styles.qsS}>✓ {metrics.successes}</span>
                <span className={styles.qsF}>✕ {metrics.fails}</span>
                <span
                  className={`${styles.scoreTag} ${scoreClass(metrics.score)}`}
                >
                  {metrics.score === null ? "—" : `${metrics.score}%`}
                </span>
              </>
            )}
          </div>
        </div>

        <select
          className={styles.inlineTicket}
          value={session.ticketId ?? ""}
          title="Assign ticket"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            assignSessionsToTicket([session.id], event.target.value || null);
          }}
        >
          <option value="">NO TICKET</option>
          {tickets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        {!isLiveCurrent && (
          <button
            type="button"
            className={styles.actionBtn}
            title="Rename session"
            onClick={(event) => {
              event.stopPropagation();
              openModal("renameSession", session.id);
            }}
          >
            Rename
          </button>
        )}
        {!isLiveCurrent && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.danger}`}
            title="Delete session"
            onClick={(event) => {
              event.stopPropagation();
              deleteSessions([session.id]);
            }}
          >
            Delete
          </button>
        )}
        <span className={styles.collapseIcon}>▼</span>
      </div>

      {expanded && (
        <div className={styles.entries}>
          <div className={styles.entriesSummary}>
            {isLego && legoMetrics ? (
              <>
                <span className={styles.chip}>
                  SPEED{" "}
                  {legoMetrics.secPerPiece === null
                    ? "—"
                    : `${legoMetrics.secPerPiece.toFixed(1)}s/pc`}
                </span>
                <span className={styles.chip}>PLACED {legoMetrics.placed}</span>
                <span className={styles.chip}>FAILED {legoMetrics.failed}</span>
                <span className={styles.chip}>
                  BAD GRASP {legoMetrics.badGrasps}
                </span>
                <span className={styles.chip}>
                  GLITCHED {legoMetrics.glitchedRollouts}
                </span>
                <span className={styles.chip}>
                  ROLLOUTS {legoMetrics.rollouts}
                </span>
                {operatorList && (
                  <span className={styles.chip}>OPERATORS: {operatorList}</span>
                )}
              </>
            ) : (
              <>
                <span className={styles.chip}>
                  QUALITY {(metrics.qualityConfidence * 100).toFixed(1)}%
                </span>
                <span className={styles.chip}>
                  RISK {(metrics.riskConfidence * 100).toFixed(1)}%
                </span>
                <span className={styles.chip}>
                  RAW {metrics.score === null ? "—" : `${metrics.score}%`}
                </span>
                <span className={styles.chip}>
                  RATE {metrics.ratePerMinute.toFixed(2)}/MIN
                </span>
                <span className={styles.chip}>
                  DURATION {formatClock(metrics.elapsedMs / 1000)}
                </span>
                <span className={styles.chip}>TOTAL {metrics.total}</span>
                {operatorList && (
                  <span className={styles.chip}>OPERATORS: {operatorList}</span>
                )}
              </>
            )}
          </div>

          {eventChips.length > 0 && (
            <div className={styles.eventSummary}>
              {eventChips.map((def) => (
                <span
                  key={def.id}
                  className={`${styles.eventChip} ${
                    def.valence === "positive"
                      ? styles.eventGood
                      : styles.eventBad
                  }`}
                >
                  {def.label} ×{metrics.events[def.id]}
                </span>
              ))}
            </div>
          )}

          <div className={styles.commentWrap}>
            <div className={styles.commentTopRow}>
              <div className={styles.commentLabel}>Comment (optional)</div>
              <div
                className={styles.commentVoiceControls}
                onClick={(event) => event.stopPropagation()}
              >
                <select
                  className={styles.voiceLangSelect}
                  value={dictationLang}
                  disabled={!speechSupported || dictating || translating}
                  aria-label="Speech input language"
                  title="Speech input language"
                  onChange={(event) => {
                    setDictationLang(event.target.value as SpeechLang);
                    setDictationStatus(null);
                  }}
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="ru">RU</option>
                </select>
                <button
                  type="button"
                  className={`${styles.micBtn} ${dictating ? styles.micBtnOn : ""}`}
                  disabled={!speechSupported || translating}
                  onClick={() => {
                    if (dictating) stopDictation();
                    else startDictation();
                  }}
                >
                  {dictating ? "Stop Mic" : "Mic"}
                </button>
              </div>
            </div>
            <textarea
              className={styles.commentInput}
              maxLength={COMMENT_MAX}
              placeholder="Add a short note for this session..."
              value={session.comment}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) =>
                setSessionComment(session.id, event.target.value)
              }
            />
            <div className={styles.dictationStatus}>
              {!speechSupported
                ? "Speech input is not available in this browser."
                : interimDictation
                  ? `Listening: ${interimDictation}`
                  : (dictationStatus ??
                    "Mic: EN adds direct text. ES/RU adds translated English text.")}
            </div>
            <div className={styles.commentMeta}>
              {session.comment.length}/{COMMENT_MAX}
            </div>
          </div>

          {sessionEntries(session).length === 0 ? (
            <div className={styles.noEntries}>No entries yet.</div>
          ) : (
            <div className={styles.entryListWrap}>
              <button
                type="button"
                className={styles.entryToggle}
                onClick={() => setEntriesOpen((open) => !open)}
              >
                <span className={styles.entryToggleIcon}>
                  {entriesOpen ? "▾" : "▸"}
                </span>
                {entriesOpen ? "HIDE" : "SHOW"} ENTRIES (
                {sessionEntries(session).length})
              </button>
              {entriesOpen && <EntryList session={session} />}
            </div>
          )}

          {group === "stopped" && (
            <button
              type="button"
              className={styles.resumeBtn}
              onClick={(event) => {
                event.stopPropagation();
                resumeSession(session.id);
              }}
            >
              ▶ RESUME SESSION
            </button>
          )}
        </div>
      )}
    </div>
  );
}
