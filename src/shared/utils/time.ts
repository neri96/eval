/** Format whole seconds as MM:SS (mirrors legacy formatTime). */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(
    0,
    Number.isFinite(totalSeconds) ? Math.floor(totalSeconds) : 0,
  );
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Human label for a session start time (mirrors legacy getSessionLabel fallback). */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "UNTITLED SESSION";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
