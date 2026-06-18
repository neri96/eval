import { Routes, Route } from "react-router-dom";
import AppHeader from "./AppHeader";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

import { HomePage } from "@/pages/HomePage";
import { TicketPage } from "@/pages/TicketPage";

import { UndoToast } from "@/features/history/components/UndoToast";
import { ModalHost } from "@/features/modals/components/ModalHost";

function App() {
  useKeyboardShortcuts();

  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketPage />} />
      </Routes>
      <UndoToast />
      <ModalHost />
    </>
  );
}

export default App;
