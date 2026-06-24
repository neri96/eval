import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Dialog } from "radix-ui";
import { useEvalStore } from "@/store/evalStore";
import { selectTickets } from "@/store/selectors";
import styles from "./Modal.module.css";

// Body mounts fresh on open, so the selection resets via useState (no effect).
function DeleteTicketModalBody() {
  const tickets = useEvalStore(useShallow(selectTickets));
  const sessions = useEvalStore((state) => state.sessions);
  const deleteTicket = useEvalStore((state) => state.deleteTicket);
  const closeModal = useEvalStore((state) => state.closeModal);
  const [selectId, setSelectId] = useState("");

  const sessionCount = (ticketId: string) =>
    sessions.filter((session) => session.ticketId === ticketId).length;

  const selectedCount = selectId ? sessionCount(selectId) : 0;
  const canDelete = Boolean(selectId) && selectedCount === 0;

  let note = "Only empty tickets can be deleted.";
  let isError = false;
  if (!tickets.length) {
    note = "No tickets exist yet.";
  } else if (selectId && selectedCount > 0) {
    note = `This ticket still has ${selectedCount} session${
      selectedCount === 1 ? "" : "s"
    }. Move or delete them first.`;
    isError = true;
  } else if (selectId) {
    note = "This ticket is empty and can be deleted.";
  }

  const confirm = () => {
    if (!canDelete) return;
    deleteTicket(selectId);
    closeModal();
  };

  return (
    <>
      <Dialog.Title className={styles.title}>Delete Ticket</Dialog.Title>
      <select
        className={styles.modalSelect}
        value={selectId}
        onChange={(event) => setSelectId(event.target.value)}
      >
        <option value="">SELECT A TICKET</option>
        {tickets.map((ticket) => (
          <option key={ticket.id} value={ticket.id}>
            {ticket.name} ({sessionCount(ticket.id)})
          </option>
        ))}
      </select>
      <div className={`${styles.note} ${isError ? styles.error : ""}`}>
        {note}
      </div>
      <div className={styles.btns}>
        <Dialog.Close asChild>
          <button type="button" className={styles.btn}>
            Cancel
          </button>
        </Dialog.Close>
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          disabled={!canDelete}
          onClick={confirm}
        >
          Delete
        </button>
      </div>
    </>
  );
}

export function DeleteTicketModal({ open }: { open: boolean }) {
  const closeModal = useEvalStore((state) => state.closeModal);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.modal} aria-describedby={undefined}>
          <DeleteTicketModalBody />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
