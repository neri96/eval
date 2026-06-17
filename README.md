# EVALS

Robotics evaluation tracker — a timed session scorer for logging PASS/FAIL trials
and anomaly events, grouping runs by ticket/model, and exporting results.

Migrated from a single-file prototype ([`legacy/evals.html`](legacy/evals.html))
to React + TypeScript + Vite.

## Stack

- **React 19 + TypeScript** (Vite)
- **Zustand** — app state + localStorage persistence
- **Zod** — schema validation / data normalization
- **Radix UI** — accessible dialog / select / checkbox primitives
- **CSS Modules** + `:root` design tokens (`src/styles/globals.css`)

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # typecheck (tsc -b) + production build
npm run preview  # preview the production build
npm run lint     # run eslint
```

## Structure

```
src/
  app/        # app shell + header
  features/   # events, history, scoring, sessions (components / hooks / utils each)
  shared/     # cross-feature components, hooks, utils, types
  styles/     # globals.css (design tokens + reset)
legacy/       # original single-file prototype (reference only)
```
