import { useMemo } from "react";
import type { Run } from "../../shared/events";
import { RunPane } from "./RunPane";

export function RunGrid({
  runs,
  focusedRunId,
  onFocus,
  onStop,
  onPromote,
  onDiscard,
  onRemove,
}: {
  runs: Run[];
  focusedRunId: string | null;
  onFocus: (id: string | null) => void;
  onStop: (id: string) => void;
  onPromote: (id: string) => void;
  onDiscard: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // Focused run fills the whole grid. Otherwise show the latest batch's
  // runs side-by-side. Older batches stay in the sidebar for focus-mode.
  const visible = useMemo(() => {
    if (focusedRunId) {
      const found = runs.find((r) => r.id === focusedRunId);
      return found ? [found] : [];
    }
    if (runs.length === 0) return [];
    const latestBatch = runs.reduce((acc, r) =>
      r.startedAt > acc.startedAt ? r : acc,
    ).batchId;
    return runs
      .filter((r) => r.batchId === latestBatch)
      .sort((a, b) => a.variantIndex - b.variantIndex);
  }, [runs, focusedRunId]);

  if (visible.length === 0) {
    return (
      <div className="grid grid-empty">
        <div className="grid-empty-inner">
          <div className="grid-empty-title">no runs yet</div>
          <div className="grid-empty-hint">
            type a prompt above and hit <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+
            <kbd>Enter</kbd> to fan out across N worktrees.
          </div>
        </div>
      </div>
    );
  }

  const cols = columnsFor(visible.length);

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {visible.map((r) => (
        <RunPane
          key={r.id}
          run={r}
          focused={r.id === focusedRunId}
          onFocus={() => onFocus(r.id === focusedRunId ? null : r.id)}
          onStop={() => onStop(r.id)}
          onPromote={() => onPromote(r.id)}
          onDiscard={() => onDiscard(r.id)}
          onRemove={() => onRemove(r.id)}
        />
      ))}
    </div>
  );
}

function columnsFor(n: number): number {
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return 4;
}
