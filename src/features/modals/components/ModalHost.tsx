import { useEvalStore } from "@/store/evalStore";
import { getTask } from "@/shared/tasks";
import { RenameModal } from "./RenameModal";
import { RestartConfirmModal } from "./RestartConfirmModal";
import { DeleteSelectedModal } from "./DeleteSelectedModal";
import { SelectionSummaryModal } from "./SelectionSummaryModal";
import { LegoSummaryModal } from "./LegoSummaryModal";
import { TicketModal } from "./TicketModal";
import { DeleteTicketModal } from "./DeleteTicketModal";

/**
 * Renders the active modal based on the store's `activeModal` route.
 * The summary modal is task-specific (cube success-rate vs. lego throughput).
 */
export function ModalHost() {
  const activeModal = useEvalStore((state) => state.activeModal);
  const activeTaskId = useEvalStore((state) => state.activeTaskId);

  const summaryOpen = activeModal === "selectionSummary";
  const isLego = getTask(activeTaskId).kind === "multi-rollout";

  return (
    <>
      <RenameModal open={activeModal === "renameSession"} />
      <RestartConfirmModal open={activeModal === "restart"} />
      <DeleteSelectedModal open={activeModal === "deleteSelected"} />
      {isLego ? (
        <LegoSummaryModal open={summaryOpen} />
      ) : (
        <SelectionSummaryModal open={summaryOpen} />
      )}
      <TicketModal open={activeModal === "ticket"} />
      <DeleteTicketModal open={activeModal === "deleteTicket"} />
    </>
  );
}
