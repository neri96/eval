import { useRef } from "react";
import { Dialog } from "radix-ui";
import { useEvalStore } from "@/store/evalStore";
import styles from "./Modal.module.css";

export function RenameModal({ open }: { open: boolean }) {
  const modalSessionId = useEvalStore((state) => state.modalSessionId);
  const sessions = useEvalStore((state) => state.sessions);
  const renameSession = useEvalStore((state) => state.renameSession);
  const closeModal = useEvalStore((state) => state.closeModal);
  const session = sessions.find((item) => item.id === modalSessionId) ?? null;
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (session) renameSession(session.id, inputRef.current?.value ?? "");
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
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.select();
          }}
        >
          <Dialog.Title className={styles.title}>Rename Session</Dialog.Title>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            defaultValue={session?.title ?? ""}
            maxLength={60}
            autoComplete="off"
            placeholder="SESSION TITLE..."
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
          />
          <div className={styles.btns}>
            <Dialog.Close asChild>
              <button type="button" className={styles.btn}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              onClick={commit}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
