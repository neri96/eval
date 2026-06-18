import TicketList from "@/features/tickets/components/TicketList";
import styles from "@/app/App.module.css";

export const TicketPage = () => {
  return (
    <main className={styles.main}>
      <TicketList />
    </main>
  );
};
