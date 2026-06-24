import { useEffect, useRef, useState } from "react";
import { useEvalStore } from "@/store/evalStore";
import { selectCurrentSession } from "@/store/selectors";
import styles from "./SessionMeta.module.css";

export const FOCUS_MODEL_INPUT_EVENT = "generalist:focus-model-input";

type MetaCardProps = {
  label: string;
  display: string;
  isPlaceholder: boolean;
  disabled?: boolean;
  editValue: string;
  maxLength?: number;
  focusEventName?: string;
  onCommit: (value: string) => void;
};

function MetaCard({
  label,
  display,
  isPlaceholder,
  disabled = false,
  editValue,
  maxLength = 60,
  focusEventName,
  onCommit,
}: MetaCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!focusEventName) return;
    const focusField = () => {
      if (disabled) return;
      setDraft(editValue);
      setEditing(true);
    };
    window.addEventListener(focusEventName, focusField);
    return () => window.removeEventListener(focusEventName, focusField);
  }, [disabled, editValue, focusEventName]);

  const startEditing = () => {
    if (disabled) return;
    setDraft(editValue);
    setEditing(true);
  };

  const commit = () => {
    onCommit(draft.trim());
    setEditing(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      {editing ? (
        <div className={styles.editWrap}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={draft}
            maxLength={maxLength}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setEditing(false);
            }}
          />
          <button type="button" className={styles.confirmBtn} onClick={commit}>
            SET
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setEditing(false)}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.display} ${isPlaceholder ? styles.placeholder : ""} ${
            disabled ? styles.disabled : ""
          }`}
          onClick={startEditing}
        >
          {display}
        </button>
      )}
    </div>
  );
}

export function SessionMeta() {
  const current = useEvalStore(selectCurrentSession);
  const defaultModel = useEvalStore((state) => state.defaultModel);
  const setCurrentTitle = useEvalStore((state) => state.setCurrentTitle);
  const setCurrentModel = useEvalStore((state) => state.setCurrentModel);
  const setDefaultModel = useEvalStore((state) => state.setDefaultModel);

  const title = current?.title ?? "";
  const modelValue = current ? current.model : defaultModel;

  const titleDisplay = !current
    ? "START A SESSION TO ADD TITLE"
    : title || "+ ADD SESSION TITLE";
  const modelDisplay = modelValue || "+ SET DEFAULT MODEL";

  return (
    <div className={styles.grid}>
      <MetaCard
        label="SESSION TITLE"
        display={titleDisplay}
        isPlaceholder={!title}
        disabled={!current}
        editValue={title}
        onCommit={setCurrentTitle}
      />
      <MetaCard
        label="MODEL"
        display={modelDisplay}
        isPlaceholder={!modelValue}
        editValue={modelValue}
        focusEventName={FOCUS_MODEL_INPUT_EVENT}
        onCommit={(value) => {
          setDefaultModel(value);
          if (current) setCurrentModel(value);
        }}
      />
    </div>
  );
}
