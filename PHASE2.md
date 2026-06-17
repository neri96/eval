# EVALS React port — phase handoff

Porting `legacy/{evals.html,styles.css,app.js}` (single-file prototype) to
React 19 + TypeScript + Vite + Zustand + CSS Modules.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| Store | slices (`sessions/tickets/history/ui`), selectors, helpers, `persist(immer)` | ✅ done |
| 1 | Control deck: timer, duration, session meta, transport + new/color, verdict + stats, events, keyboard, live tick | ✅ done |
| 2a | History **controls bar**: status tabs + counts, search, ticket filter, sort + the filtering/sorting/Wilson selectors | ✅ done |
| 2b | History **session cards** (list, expand, entries, comment, inline ticket, rename/delete/resume) | ✅ done |
| 2c | **Undo toast** + ⌘/Ctrl+Z (restore delete/erase) | ✅ done |
| 3a | Radix modals — **rename + erase done** (`ModalHost` routes off `activeModal`); ticket / delete-selected / delete-ticket remain | 🚧 |
| 3b-i | Select-mode toolbar (SELECT / ALL VISIBLE / CLEAR / DELETE SELECTED) + delete-selected modal | ✅ done |
| 3b-ii | Selection **summary modal** (metrics + list/chart/by-model, Wilson + model aggregation, copy) + SUMMARIZE button | ✅ done |
| 3b-iii | Ticket modal (create/assign) + delete-ticket modal (empty-only guard) + toolbar buttons | ✅ done |
| 3c | CSV / JSON export | ✅ done |

**Port complete — Phases 1, 2, and 3 all done.** Remaining polish (optional): summary
column-header sorting, single-card "+ new ticket" inline option, legacy localStorage importer.

Note: summary modal column-header sorting was deferred (default sort: sessions by
score, models by confidence). The clipboard text is a condensed port. `summary.ts`
holds the aggregation; `SelectionSummaryModal` the view.

Verify after each change: `npm run build` (tsc + vite) and `npm run lint` both
green; preview on port 5199 (`.claude/launch.json`).

## Where things live

- `src/store/evalStore.ts` — combiner; `src/store/slices/*` — actions; `src/store/selectors.ts`; `src/store/helpers.ts`
- `src/shared/types.ts`, `src/shared/constants.ts` (`SESSION_COLORS`, `ANOMALY_KINDS`, `EVENT_TYPES`)
- `src/features/{sessions,scoring,events,history}/components/*` + co-located `*.module.css`
- Replace the placeholder in `src/features/history/components/HistoryPanel.tsx` with the real card list.

## 2b — session cards

Build `src/features/history/components/SessionCard.tsx` (+ `.module.css`) and render the
list in `HistoryPanel` from `selectFilteredSessions`.

**List subscription (gotcha):** `selectFilteredSessions` returns a NEW array each call →
do NOT subscribe to it directly (breaks `useSyncExternalStore`). Use shallow compare:

```ts
import { useShallow } from "zustand/react/shallow";
const sessions = useEvalStore(useShallow(selectFilteredSessions));
```

**Selectors already available:** `selectFilteredSessions`, `getSessionMetrics`
(score, ratePerMinute, qualityConfidence, riskConfidence, elapsedMs), `getSessionStats`,
`sessionStatusGroup`.

**Store actions available for the card:** `resumeSession(id)`, `renameSession(id, title)`,
`deleteSessions([id])`, `assignSessionsToTicket([id], ticketId|null)`,
`toggleSessionSelected(id)` / `selectMode` / `selectedSessionIds`.

**Store action added in 2b:** `setSessionComment(sessionId, comment)` in `sessionsSlice`
(uses `sanitizeComment`) — drives the card comment textarea.

**Card pieces (mirror legacy):** status dot + label (active/done/stopped from
`sessionStatusGroup`), title/model/color tags, event dot tags, ticket tag, quick stats
(✓/✕/score), quality-or-risk rank tag (depends on `historySort`), collapse toggle →
expanded body with summary chips + entries timeline (verdict `PASS/FAIL @ ts`, anomaly
events) + comment textarea + inline ticket `<select>` + RESUME (when not active and not
done) / Rename / Delete buttons.

**Legacy reference:** markup/logic in `app.js` → `buildSessionCard`, `buildEntriesMarkup`,
`buildCardEventTags`, `buildEventDotsMarkup`, `buildInlineTicketOptions`, `renderHistory`.
Styles in `styles.css` → the `.session-card*`, `.session-*-tag`, `.entry-row*`,
`.session-entries*`, `.session-comment*`, `.resume-btn` block (~lines 859–1600).
Inline "+ NEW TICKET…" in the ticket select opens the ticket modal → defer that option to
Phase 3; for 2b support existing tickets + "no ticket" only.

## 2c — undo toast

`src/features/history/components/UndoToast.tsx`: watch `recentlyRemoved` (set by
`deleteSessions` and `eraseCurrentSession`), show for 5s with a draining bar, Undo →
`restoreRemoved()`, auto-dismiss → `dismissRemoved()`. Styles: `styles.css` `.undo-toast*`.
Confirm modals (delete/erase) are Phase 3 (Radix Dialog) — erase is already undoable via
the snapshot, so wiring direct is fine until then.

## Conventions

- CSS Modules with camelCase class names; keep `:root` tokens in `src/styles/globals.css`.
- Subscribe to actions individually (`useEvalStore(s => s.action)` — stable refs); use
  `useShallow` for array/object selectors.
- Status meaning: `initial|active|paused` → "active" tab; `done` → done; `stopped` → stopped.
- Persist key is `evals-store` (fresh; not the legacy `robot_eval_v6`). A legacy localStorage
  importer was discussed but not built — ask before adding.
