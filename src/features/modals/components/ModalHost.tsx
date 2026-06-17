import { useEvalStore } from "@/store/evalStore";
import { RenameModal } from "./RenameModal";
import { EraseConfirmModal } from "./EraseConfirmModal";
import { DeleteSelectedModal } from "./DeleteSelectedModal";
import { SelectionSummaryModal } from "./SelectionSummaryModal";
import { TicketModal } from "./TicketModal";
import { DeleteTicketModal } from "./DeleteTicketModal";

/**
 * Renders the active modal based on the store's `activeModal` route.
 * Phase 3 adds ticket / delete-selected / delete-ticket / summary here.
 */
export function ModalHost() {
  const activeModal = useEvalStore((state) => state.activeModal);

  return (
    <>
      <RenameModal open={activeModal === "renameSession"} />
      <EraseConfirmModal open={activeModal === "erase"} />
      <DeleteSelectedModal open={activeModal === "deleteSelected"} />
      <SelectionSummaryModal open={activeModal === "selectionSummary"} />
      <TicketModal open={activeModal === "ticket"} />
      <DeleteTicketModal open={activeModal === "deleteTicket"} />
    </>
  );
}
