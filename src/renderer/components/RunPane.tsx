import { useEffect, useRef } from "react";
import type { Run } from "../../shared/events";
import { StatusDot } from "./StatusDot";
import { Timeline } from "./Timeline";

export function RunPane({
  run,
  focused,
  onFocus,
  onStop,
  onPromote,
  onDiscard,
  onRemove,
}: {
  run: Run;
  focused: boolean;
  onFocus: () => void;
  onStop: () => void;
  onPromote: () => void;
  onDiscard: () => void;
  onRemove: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-stick to bottom as new items stream in, unless the user has
  // scrolled up to read earlier output.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [run.items.length]);

  const isRunning = run.status === "running";
  const isTerminal =
    run.status === "done" ||
    run.status === "error" ||
    run.status === "aborted";
  const isPromoted = run.status === "promoted";
  const isDiscarded = run.status === "discarded";

  return (
    <div className={`pane ${focused ? "focused" : ""} status-${run.status}`}>
      <div className="pane-head">
        <StatusDot status={run.status} />
        <span className="pane-idx">#{run.variantIndex}</span>
        <span className="pane-label" title={run.prompt}>
          {run.label}
        </span>
        <span className="pane-totals">
          {run.totals.costUsd > 0 && <>${run.totals.costUsd.toFixed(4)}</>}
          {run.totals.outputTokens > 0 && (
            <> · {fmtTokens(run.totals.outputTokens)} out</>
          )}
        </span>
        <button
          className="pane-focus"
          onClick={onFocus}
          title={focused ? "exit focus" : "focus this run"}
        >
          {focused ? "⊟" : "⊞"}
        </button>
      </div>
      <div className="pane-body" ref={scrollRef}>
        {run.items.length === 0 && (
          <div className="pane-waiting">
            {run.status === "pending"
              ? "creating worktree…"
              : run.status === "running"
                ? "waiting for first event…"
                : `status: ${run.status}`}
          </div>
        )}
        <Timeline items={run.items} />
        {run.errorMessage && (
          <div className="pane-error">× {run.errorMessage}</div>
        )}
      </div>
      <div className="pane-actions">
        {isRunning && (
          <button className="act act-stop" onClick={onStop}>
            Stop
          </button>
        )}
        {isTerminal && (
          <>
            <button className="act act-promote" onClick={onPromote}>
              Promote
            </button>
            <button className="act act-discard" onClick={onDiscard}>
              Discard
            </button>
          </>
        )}
        {(isPromoted || isDiscarded) && (
          <button className="act" onClick={onRemove}>
            Remove from list
          </button>
        )}
        <span className="pane-branch" title={run.worktreePath}>
          {run.branch || "—"}
        </span>
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
