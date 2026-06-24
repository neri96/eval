import { getTask } from "@/shared/tasks";
import type { EventId, TaskId } from "@/shared/types";

/** Spoken variants for each event id (the glitch event is intentionally
 *  excluded — a misheard word must never be able to end a rollout). */
const EVENT_ALIASES: Partial<Record<EventId, string[]>> = {
  collision: ["collision", "collide", "crash", "hit"],
  dropped: ["dropped", "drop", "fell"],
  phantom: ["phantom", "ghost"],
  shaky: ["shaky", "shake", "wobble", "wobbly"],
  random: ["random"],
  spill: ["spill", "spilled", "spillage", "scatter"],
  ignored_outside: ["ignored", "ignore", "outside", "skipped", "skip"],
  miss: ["miss", "missed"],
  multi_grab: [
    "multi grab",
    "multigrab",
    "double grab",
    "two pieces",
    "multiple",
  ],
  good_recovery: ["good recovery", "recovery", "recovered", "recover"],
};

const VERDICT_ALIASES = {
  success: [
    "success",
    "pass",
    "passed",
    "good",
    "yes",
    "got it",
    "placed",
    "place",
  ],
  fail: ["fail", "failed", "failure", "no", "retry"],
  bad_grasp: ["bad", "bad grasp"],
};

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VocabEntry = { id: string; label: string; phrases: string[] };
export type Vocab = VocabEntry[];

function phrasesFor(
  label: string,
  id: string,
  aliases: readonly string[] = [],
) {
  return [
    ...new Set([label, id.replace(/_/g, " "), ...aliases].map(normalizeSpeech)),
  ].filter(Boolean);
}

/** Event vocabulary for a task (excludes terminal/rollout-ending events). */
export function buildEventVocab(taskId: TaskId): Vocab {
  return getTask(taskId)
    .events.filter((event) => !event.endsRollout && !event.primary)
    .map((event) => ({
      id: event.id,
      label: event.label,
      phrases: phrasesFor(event.label, event.id, EVENT_ALIASES[event.id]),
    }));
}

/** Verdict vocabulary (success/fail) with task-appropriate labels. */
export function buildVerdictVocab(taskId: TaskId): Vocab {
  const multi = getTask(taskId).kind === "multi-rollout";
  const vocab: Vocab = [
    {
      id: "success",
      label: multi ? "Placed" : "Success",
      phrases: phrasesFor(
        multi ? "Placed" : "Success",
        "success",
        VERDICT_ALIASES.success,
      ),
    },
    {
      id: "fail",
      label: multi ? "Failed" : "Fail",
      phrases: phrasesFor(
        multi ? "Failed" : "Fail",
        "fail",
        VERDICT_ALIASES.fail,
      ),
    },
  ];
  if (multi) {
    vocab.push({
      id: "bad_grasp",
      label: "Bad Grasp",
      phrases: phrasesFor("Bad Grasp", "bad_grasp", VERDICT_ALIASES.bad_grasp),
    });
  }
  return vocab;
}

/** Levenshtein edit distance (small strings, so the simple DP is fine). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prevDiag = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prevDiag + cost);
      prevDiag = tmp;
    }
  }
  return row[n];
}

/** Are two spoken words "close enough"? Tolerance scales with length so
 *  short words need to be near-exact but longer ones forgive a typo or two
 *  ("spell"→"spill", "muti"→"multi", "ignore"→"ignored"). */
function wordSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return false; // too short to fuzzy safely
  const distance = editDistance(a, b);
  if (maxLen <= 5) return distance <= 1;
  return distance <= 2;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "it",
  "that",
  "this",
  "was",
  "is",
  "to",
  "of",
  "my",
  "i",
  "he",
  "she",
  "they",
  "we",
  "and",
  "just",
  "like",
  "there",
]);

/** Score how well a transcript (its words) matches one vocabulary phrase. */
function scorePhrase(words: string[], phrase: string): number {
  const phraseWords = phrase
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  if (!phraseWords.length) return 0;

  let matched = 0;
  let exact = 0;
  let matchedLen = 0;
  for (const pw of phraseWords) {
    let hit: "exact" | "fuzzy" | null = null;
    for (const w of words) {
      if (w === pw) {
        hit = "exact";
        break;
      }
      if (!hit && wordSimilar(w, pw)) hit = "fuzzy";
    }
    if (hit === "exact") {
      matched += 1;
      exact += 1;
      matchedLen += pw.length;
    } else if (hit === "fuzzy") {
      matched += 1;
      matchedLen += pw.length * 0.6;
    }
  }
  if (matched === 0) return 0;
  const coverage = matched / phraseWords.length;
  return (
    coverage * 40 +
    matchedLen +
    exact * 8 +
    (matched === phraseWords.length ? 15 : 0)
  );
}

// Below this, a match is too weak to trust (keeps gibberish a no-match).
const MIN_SCORE = 18;

/** Best single command match in `vocab`, or null if nothing is close enough. */
export function matchCommand(
  transcript: string,
  vocab: Vocab,
): { id: string; label: string } | null {
  const t = normalizeSpeech(transcript);
  if (!t) return null;
  const words = t.split(" ").filter((w) => w.length >= 2);
  let best: { id: string; label: string; score: number } | null = null;
  for (const entry of vocab) {
    for (const phrase of entry.phrases) {
      const score = scorePhrase(words, phrase);
      if (score > 0 && (!best || score > best.score)) {
        best = { id: entry.id, label: entry.label, score };
      }
    }
  }
  return best && best.score >= MIN_SCORE
    ? { id: best.id, label: best.label }
    : null;
}

/**
 * Verdicts arrive rapidly and may be merged into one transcript ("placed
 * placed failed"), so we match per word (with fuzzy tolerance) and return
 * each verdict in order.
 */
export function matchVerdicts(transcript: string, vocab: Vocab): string[] {
  const t = normalizeSpeech(transcript);
  if (!t) return [];
  const out: string[] = [];
  for (const word of t.split(" ")) {
    if (word.length < 2) continue;
    let best: { id: string; score: number } | null = null;
    for (const entry of vocab) {
      for (const phrase of entry.phrases) {
        if (phrase.includes(" ")) continue; // verdicts are single words
        let score = 0;
        if (word === phrase) score = 100 + phrase.length;
        else if (wordSimilar(word, phrase)) score = 50 + phrase.length;
        if (score > 0 && (!best || score > best.score)) {
          best = { id: entry.id, score };
        }
      }
    }
    if (best) out.push(best.id);
  }
  return out;
}
