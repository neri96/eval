import { useState } from "react";
import { Dialog } from "radix-ui";
import { useEvalStore } from "@/store/evalStore";
import styles from "./Modal.module.css";

const parseOperators = (raw: string) =>
  raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

// Body mounts fresh each time the modal opens, so local state seeds via
// useState initializers (no open-seeding effect needed).
function TicketModalBody() {
  const mode = useEvalStore((state) => state.ticketModalMode);
  const tickets = useEvalStore((state) => state.tickets);
  const selectedIds = useEvalStore((state) => state.selectedSessionIds);
  const createTicket = useEvalStore((state) => state.createTicket);
  const assignSessionsToTicket = useEvalStore(
    (state) => state.assignSessionsToTicket,
  );
  const updateTicketOperators = useEvalStore(
    (state) => state.updateTicketOperators,
  );
  const setCurrentTicketId = useEvalStore((state) => state.setCurrentTicketId);
  const closeModal = useEvalStore((state) => state.closeModal);

  const [selectId, setSelectId] = useState("");
  const [name, setName] = useState("");
  const [operators, setOperators] = useState("");

  const onSelectChange = (value: string) => {
    setSelectId(value);
    const ticket = tickets.find((item) => item.id === value);
    setOperators(ticket ? ticket.operators.join(", ") : "");
  };

  const apply = () => {
    const cleanedName = name.trim();
    const ops = parseOperators(operators);

    if (mode === "create") {
      if (!cleanedName) return;
      const ticketId = createTicket(cleanedName, ops);
      setCurrentTicketId(ticketId);
      closeModal();
      return;
    }

    let ticketId: string | null;
    if (cleanedName) {
      ticketId = createTicket(cleanedName, ops);
    } else if (selectId === "ungrouped") {
      ticketId = null;
    } else if (selectId) {
      ticketId = selectId;
      updateTicketOperators(selectId, ops);
    } else {
      return;
    }

    assignSessionsToTicket(selectedIds, ticketId);
    closeModal();
  };

  return (
    <>
      <Dialog.Title className={styles.title}>
        {mode === "create" ? "Create Ticket" : "Add Selected to Ticket"}
      </Dialog.Title>

      {mode === "assign" && (
        <select
          className={styles.modalSelect}
          value={selectId}
          onChange={(event) => onSelectChange(event.target.value)}
        >
          <option value="">SELECT A TICKET</option>
          <option value="ungrouped">NO TICKET</option>
          {tickets.map((ticket) => (
            <option key={ticket.id} value={ticket.id}>
              {ticket.name}
            </option>
          ))}
        </select>
      )}

      <input
        className={styles.input}
        type="text"
        value={name}
        maxLength={60}
        autoComplete="off"
        placeholder={mode === "create" ? "TICKET NAME" : "OR CREATE NEW TICKET"}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
      />
      <input
        className={styles.input}
        type="text"
        value={operators}
        maxLength={200}
        autoComplete="off"
        placeholder="OPERATORS (COMMA SEPARATED)"
        onChange={(event) => setOperators(event.target.value)}
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
          onClick={apply}
        >
          {mode === "create" ? "Create" : "Apply"}
        </button>
      </div>
    </>
  );
}

export function TicketModal({ open }: { open: boolean }) {
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
          <TicketModalBody />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
