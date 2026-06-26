import type { CubeOrder } from "./types";

/** The 5x3 cell layout used by the cube-in-bowl grid task. */
export const POSITIONS = [
  { id: 1, cell: "A1", row: "A", col: 1 },
  { id: 2, cell: "A2", row: "A", col: 2 },
  { id: 3, cell: "A3", row: "A", col: 3 },
  { id: 4, cell: "A4", row: "A", col: 4 },
  { id: 5, cell: "A5", row: "A", col: 5 },
  { id: 6, cell: "B1", row: "B", col: 1 },
  { id: 7, cell: "B2", row: "B", col: 2 },
  { id: 8, cell: "B3", row: "B", col: 3 },
  { id: 9, cell: "B4", row: "B", col: 4 },
  { id: 10, cell: "B5", row: "B", col: 5 },
  { id: 11, cell: "C1", row: "C", col: 1 },
  { id: 12, cell: "C2", row: "C", col: 2 },
  { id: 13, cell: "C3", row: "C", col: 3 },
  { id: 14, cell: "C4", row: "C", col: 4 },
  { id: 15, cell: "C5", row: "C", col: 5 },
] as const;

export type PositionId = (typeof POSITIONS)[number]["id"];

/** The first cell in grid order — where the bowl starts a matrix sweep. */
export const FIRST_CELL: PositionId = POSITIONS[0].id;

const indexOf = (id: PositionId) => POSITIONS.findIndex((p) => p.id === id);
const byId = (id: PositionId) => POSITIONS[indexOf(id)];

/** The human-readable cell label (e.g. "A2") for a position id. */
export function cellLabel(id: PositionId): string {
  return byId(id).cell;
}
const rowIndex = (row: string) => row.charCodeAt(0) - 65; // "A" -> 0

/** Chebyshev (king-move) distance between two cells; adjacent cells = 1. */
export function cellDistance(a: PositionId, b: PositionId): number {
  const pa = byId(a);
  const pb = byId(b);
  return Math.max(
    Math.abs(rowIndex(pa.row) - rowIndex(pb.row)),
    Math.abs(pa.col - pb.col),
  );
}

/** A Fisher–Yates shuffled copy. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The cells the cube visits in one pass. `exclude` keeps the cube off the
 * bowl's cell (matrix mode, where the bowl owns a cell for the whole pass);
 * "random" order shuffles the route, "ordered" keeps grid order.
 */
export function passCells(order: CubeOrder, exclude?: PositionId): PositionId[] {
  const ids = POSITIONS.map((p) => p.id).filter((id) => id !== exclude);
  return order === "random" ? shuffle(ids) : ids;
}

/**
 * A random bowl cell for standard mode: never on the cube, never repeating the
 * previous bowl cell, and preferring cells at least two steps from the cube
 * (falling back to any valid cell when no distant one is available).
 */
export function randomBowlCell(
  cube: PositionId,
  prevBowl: PositionId | null | undefined,
): PositionId {
  const candidates = POSITIONS.map((p) => p.id).filter(
    (id) => id !== cube && id !== prevBowl,
  );
  const far = candidates.filter((id) => cellDistance(id, cube) >= 2);
  const pool = far.length ? far : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** The next bowl cell in grid order (matrix mode), wrapping at the end. */
export function nextBowlGrid(bowl: PositionId): PositionId {
  return POSITIONS[(indexOf(bowl) + 1) % POSITIONS.length].id;
}
