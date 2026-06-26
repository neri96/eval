import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CubeWorkspace } from "@/features/cube/CubeWorkspace";
import { LegoWorkspace } from "@/features/lego/components/LegoWorkspace";

import { useEvalStore } from "@/store/evalStore";
import { getTask, isTaskId } from "@/shared/tasks";
import type { TaskId } from "@/shared/types";

import styles from "@/app/App.module.css";

/** Each task picks its own workspace component, even if it shares a `kind`. */
function renderWorkspace(taskId: TaskId) {
  switch (taskId) {
    case "lego-transfer":
      return <LegoWorkspace />;
    case "cube-in-bowl":
      return <CubeWorkspace />;
  }
}

export function TaskWorkspace() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const setActiveTask = useEvalStore((state) => state.setActiveTask);

  const valid = isTaskId(taskId) && getTask(taskId).available;

  useEffect(() => {
    if (isTaskId(taskId) && getTask(taskId).available) {
      setActiveTask(taskId);
    } else {
      navigate("/", { replace: true });
    }
  }, [taskId, navigate, setActiveTask]);

  if (!valid || !taskId) return null;

  return <main className={styles.main}>{renderWorkspace(taskId)}</main>;
}
