import { useNavigate } from "react-router-dom";

import { useEvalStore } from "@/store/evalStore";
import { TASK_LIST } from "@/shared/tasks";
import type { TaskId } from "@/shared/types";

import styles from "./LauncherPage.module.css";

export function LauncherPage() {
  const navigate = useNavigate();
  const setActiveTask = useEvalStore((state) => state.setActiveTask);
  const sessions = useEvalStore((state) => state.sessions);

  const countFor = (id: TaskId) =>
    sessions.reduce((total, session) => total + (session.taskId === id ? 1 : 0), 0);

  const enter = (id: TaskId) => {
    setActiveTask(id);
    navigate(`/task/${id}`);
  };

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <h1 className={styles.title}>Select Task</h1>
        <p className={styles.subtitle}>Choose what you're evaluating.</p>
      </div>

      <div className={styles.grid}>
        {TASK_LIST.map((task) => {
          const count = countFor(task.id);
          return (
            <button
              key={task.id}
              type="button"
              className={`${styles.card} ${task.available ? "" : styles.disabled}`}
              disabled={!task.available}
              onClick={() => enter(task.id)}
            >
              <div className={styles.cardTop}>
                <span className={styles.cardName}>{task.label}</span>
                {task.available ? (
                  <span className={styles.enter}>→</span>
                ) : (
                  <span className={styles.soon}>Soon</span>
                )}
              </div>

              <p className={styles.blurb}>{task.blurb}</p>

              <div className={styles.cardBottom}>
                {task.colors.length > 0 ? (
                  <span className={styles.dots}>
                    {task.colors.map((color) => (
                      <span
                        key={color}
                        className={`${styles.dot} ${styles[color]}`}
                      />
                    ))}
                  </span>
                ) : (
                  <span className={styles.noColor}>no color dimension</span>
                )}
                <span className={styles.count}>
                  {count} {count === 1 ? "session" : "sessions"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
