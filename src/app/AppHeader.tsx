import useOpenTicketModal from "@/features/tickets/hooks/useOpenTicketModal";

import styles from "./AppHeader.module.css";

const AppHeader = () => {
  const openTicketModal = useOpenTicketModal();

  return (
    <header className={styles.headerBar}>
      <div className={styles.logo}>EVALS</div>
      <nav>
        <div>
          <button
            type="button"
            className={styles.utilityBtn}
            onClick={openTicketModal}
          >
            ✎
          </button>
        </div>
      </nav>
    </header>
  );
};

export default AppHeader;
