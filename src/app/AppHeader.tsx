import { useNavigate } from "react-router-dom";

import useOpenTicketModal from "@/features/tickets/hooks/useOpenTicketModal";

import styles from "./AppHeader.module.css";

const AppHeader = () => {
  const navigate = useNavigate();
  const openTicketModal = useOpenTicketModal();

  return (
    <header className={styles.headerBar}>
      <div className={styles.logo}>EVALS</div>
      <nav className={styles.nav}>
        <div>
          <button
            type="button"
            className={styles.utilityBtn}
            onClick={openTicketModal}
          >
            ✎
          </button>
        </div>
        <div>
          <button
            type="button"
            className={styles.utilityBtn}
            onClick={() => navigate("/tickets")}
          >
            ▦
          </button>
        </div>
      </nav>
    </header>
  );
};

export default AppHeader;
