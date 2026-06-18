import { Dialog } from "radix-ui";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import { formatDateLabel } from "@/shared/utils/time";
import styles from "./Modal.module.css";

export function RestartConfirmModal({ open }: { open: boolean }) {
  const current = useEvalStore(selectCurrentSession);
  const restartCurrentSession = useEvalStore(
    (state) => state.restartCurrentSession,
  );
  const closeModal = useEvalStore((state) => state.closeModal);

  const label = current
    ? current.title || formatDateLabel(current.startedAt)
    : "—";
  const entryCount = current?.entries.length ?? 0;

  const confirm = () => {
    restartCurrentSession();
    closeModal();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.confirmOverlay} />
        <Dialog.Content className={styles.confirm}>
          <div className={styles.confirmTop}>
            <span className={styles.confirmIcon}>↻</span>
            <Dialog.Title className={styles.confirmTitle}>
              Restart Session
            </Dialog.Title>
            <Dialog.Description className={styles.confirmBody}>
              This clears all progress and returns the session to its initial
              state. This can't be undone.
              <span className={styles.confirmName}>
                {label}
                {entryCount ? ` · ${entryCount} entries` : " · no entries"}
              </span>
            </Dialog.Description>
          </div>
          <div className={styles.confirmBtns}>
            <Dialog.Close asChild>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmCancel}`}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`${styles.confirmBtn} ${styles.confirmConfirm}`}
              onClick={confirm}
            >
              ↻ Restart
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
