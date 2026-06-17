import { useEvalStore } from "@/store/evalStore";

const useOpenTicketModal = () => {
  const openTicketModal = useEvalStore((state) => state.openTicketModal);

  return () => openTicketModal("create");
};

export default useOpenTicketModal;
