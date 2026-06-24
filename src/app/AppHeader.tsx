import { useLocation, useNavigate } from "react-router-dom";

import { useEvalStore } from "@/store/evalStore";
import { getTask } from "@/shared/tasks";
import useOpenTicketModal from "@/features/tickets/hooks/useOpenTicketModal";

import styles from "./AppHeader.module.css";

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const openTicketModal = useOpenTicketModal();
  const activeTaskId = useEvalStore((state) => state.activeTaskId);

  const onLauncher = location.pathname === "/";

  return (
    <header className={styles.headerBar}>
      <div className={styles.brand}>
        <button
          type="button"
          className={styles.logo}
          onClick={() => navigate("/")}
        >
          EVALS
        </button>
        {!onLauncher && (
          <>
            <span className={styles.sep}>/</span>
            <span className={styles.taskName}>
              {getTask(activeTaskId).label}
            </span>
          </>
        )}
      </div>

      {!onLauncher && (
        <nav className={styles.nav}>
          <button
            type="button"
            className={styles.navAction}
            onClick={openTicketModal}
          >
            <span className={styles.navActionLabel}>New ticket</span>
            <span className={styles.utilityBtn} aria-hidden="true">
              ✎
            </span>
          </button>
          <button
            type="button"
            className={styles.navAction}
            onClick={() => navigate("/tickets")}
          >
            <span className={styles.navActionLabel}>View tickets</span>
            <span className={styles.utilityBtn} aria-hidden="true">
              ▦
            </span>
          </button>
        </nav>
      )}
    </header>
  );
};

export default AppHeader;
