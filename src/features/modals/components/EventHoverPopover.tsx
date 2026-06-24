import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./SelectionSummaryModal.module.css";

export type EventPopoverRow = {
  id: string;
  label: string;
  count: number;
  dotClassName: string;
};

type PopoverPosition = {
  left: number;
  top: number;
};

const EDGE_PADDING = 12;
const POPOVER_OFFSET = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function EventHoverPopover({
  total,
  rows,
}: {
  total: number;
  rows: EventPopoverRow[];
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const showPopover = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const hidePopover = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 90);
  }, [clearCloseTimer]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const popover = popoverRef.current;
    const popoverWidth = popover?.offsetWidth ?? 220;
    const popoverHeight = popover?.offsetHeight ?? 120;
    const maxLeft = Math.max(
      EDGE_PADDING,
      window.innerWidth - popoverWidth - EDGE_PADDING,
    );
    const left = clamp(rect.right - popoverWidth, EDGE_PADDING, maxLeft);

    const bottomTop = rect.bottom + POPOVER_OFFSET;
    const top =
      bottomTop + popoverHeight + EDGE_PADDING > window.innerHeight &&
      rect.top - popoverHeight - POPOVER_OFFSET > EDGE_PADDING
        ? rect.top - popoverHeight - POPOVER_OFFSET
        : bottomTop;

    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const eventLabel = total === 1 ? "event" : "events";
  const body =
    typeof document === "undefined"
      ? null
      : createPortal(
          <span
            ref={popoverRef}
            className={styles.hoverPopover}
            style={
              position
                ? {
                    left: position.left,
                    top: position.top,
                  }
                : undefined
            }
            onPointerEnter={showPopover}
            onPointerLeave={hidePopover}
          >
            {rows.length ? (
              rows.map((event) => (
                <span key={event.id} className={styles.hoverEventRow}>
                  <span
                    className={`${styles.hoverDot} ${event.dotClassName}`}
                  />
                  {event.label} #{event.count}
                </span>
              ))
            ) : (
              <span className={styles.hoverEventRow}>No events</span>
            )}
          </span>,
          document.body,
        );

  return (
    <>
      <span
        ref={triggerRef}
        className={styles.hoverHint}
        tabIndex={0}
        aria-expanded={open}
        onFocus={showPopover}
        onBlur={hidePopover}
        onPointerEnter={showPopover}
        onPointerLeave={hidePopover}
      >
        {total} {eventLabel}
      </span>
      {open && body}
    </>
  );
}
