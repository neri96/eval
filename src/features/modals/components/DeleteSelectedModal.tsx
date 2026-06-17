import { Dialog } from "radix-ui";
import { useEvalStore } from "@/store/evalStore";
import styles from "./Modal.module.css";

export function DeleteSelectedModal({ open }: { open: boolean }) {
  const selectedIds = useEvalStore((state) => state.selectedSessionIds);
  const deleteSessions = useEvalStore((state) => state.deleteSessions);
  const closeModal = useEvalStore((state) => state.closeModal);
  const count = selectedIds.length;

  const confirm = () => {
    deleteSessions(selectedIds);
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
            <span className={styles.confirmIcon}>⌫</span>
            <Dialog.Title className={styles.confirmTitle}>
              Delete Selected
            </Dialog.Title>
            <Dialog.Description className={styles.confirmBody}>
              This deletes all selected sessions. You can undo for a few seconds
              afterwards.
              <span className={styles.confirmName}>
                {count} session{count === 1 ? "" : "s"} selected
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
              ⌫ Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
