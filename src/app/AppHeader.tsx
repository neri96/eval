import styles from "./AppHeader.module.css";

const AppHeader = () => {
  return (
    <header className={styles.headerBar}>
      <div className={styles.logo}>EVALS</div>
    </header>
  );
};

export default AppHeader;
