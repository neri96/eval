import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "./AppHeader";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

import { LauncherPage } from "@/pages/LauncherPage";
import { TaskWorkspace } from "@/pages/TaskWorkspace";
import { TicketPage } from "@/pages/TicketPage";

import { UndoToast } from "@/features/history/components/UndoToast";
import { ModalHost } from "@/features/modals/components/ModalHost";

function App() {
  useKeyboardShortcuts();

  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/" element={<LauncherPage />} />
        <Route path="/task/:taskId" element={<TaskWorkspace />} />
        <Route path="/tickets" element={<TicketPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UndoToast />
      <ModalHost />
    </>
  );
}

export default App;
