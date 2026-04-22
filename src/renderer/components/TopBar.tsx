import { useEffect, useState, KeyboardEvent } from "react";

export interface FanoutPayload {
  prompt: string;
  count: number;
  variantPrompts: string[];
}

const DEFAULT_COUNT = 3;

export function TopBar({
  repoPath,
  baseBranch,
  repoReady,
  runningCount,
  onPickRepo,
  onFanout,
  onStopAll,
}: {
  repoPath: string | null;
  baseBranch: string | null;
  repoReady: boolean;
  runningCount: number;
  onPickRepo: () => void;
  onFanout: (payload: FanoutPayload) => void;
  onStopAll: () => void;
}) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [tasks, setTasks] = useState<string[]>(() =>
    Array(DEFAULT_COUNT).fill(""),
  );

  // Keep tasks array in sync with count. New slots start empty — the user
  // must write a distinct task for every agent before fanout unlocks.
  useEffect(() => {
    setTasks((prev) => {
      if (prev.length === count) return prev;
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
  }, [count]);

  const allFilled = tasks.length === count && tasks.every((t) => t.trim().length > 0);
  const canSubmit = repoReady && allFilled;

  const submit = () => {
    if (!canSubmit) return;
    const cleaned = tasks.map((t) => t.trim());
    onFanout({
      prompt: cleaned[0], // used only as the batch's display label
      count,
      variantPrompts: cleaned,
    });
    setTasks(Array(count).fill(""));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  const updateTask = (i: number, text: string) => {
    setTasks((prev) => {
      const next = [...prev];
      next[i] = text;
      return next;
    });
  };

  const filledCount = tasks.filter((t) => t.trim().length > 0).length;

  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <div className="brand">
          <span className="brand-glyph">✻</span>
          <span className="brand-name">chorus</span>
        </div>
        <button className="repo-chip" onClick={onPickRepo} title={repoPath ?? ""}>
          <span className="repo-icon">◈</span>
          <span className="repo-label">
            {repoPath ? shortenPath(repoPath) : "pick repo"}
          </span>
          {baseBranch && <span className="repo-branch">{baseBranch}</span>}
        </button>
        <div className="topbar-spacer" />
        <div className="fanout-controls">
          <label className="count-label">
            <span>agents</span>
            <input
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
              }
            />
          </label>
          <span className="fill-indicator">
            {filledCount}/{count} tasks
          </span>
          <button className="go-btn" onClick={submit} disabled={!canSubmit}>
            Fan out →
          </button>
          {runningCount > 0 && (
            <button className="stop-all" onClick={onStopAll}>
              Stop {runningCount}
            </button>
          )}
        </div>
      </div>

      {repoReady && (
        <div className="variants">
          <div className="variants-hint">
            give each agent a distinct task. Cmd/Ctrl+Enter fans out when
            all {count} are filled.
          </div>
          <div className="variants-grid">
            {Array.from({ length: count }).map((_, i) => {
              const value = tasks[i] ?? "";
              const filled = value.trim().length > 0;
              return (
                <div key={i} className={`variant ${filled ? "filled" : ""}`}>
                  <div className="variant-head">
                    <span className="variant-idx">agent #{i}</span>
                    {!filled && <span className="variant-req">required</span>}
                  </div>
                  <textarea
                    className="variant-input"
                    value={value}
                    onChange={(e) => updateTask(i, e.target.value)}
                    onKeyDown={onKey}
                    placeholder={`what should agent #${i} do?`}
                    rows={3}
                    autoFocus={i === 0}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function shortenPath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return p;
  return `…/${parts.slice(-2).join("/")}`;
}
