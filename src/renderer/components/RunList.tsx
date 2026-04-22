import type { Run } from "../../shared/events";
import { StatusDot } from "./StatusDot";

export function RunList({
  runs,
  focusedRunId,
  onFocus,
}: {
  runs: Run[];
  focusedRunId: string | null;
  onFocus: (id: string | null) => void;
}) {
  // Sort by batch (newest first), then variant index.
  const sorted = [...runs].sort((a, b) => {
    if (a.batchId !== b.batchId) return b.startedAt - a.startedAt;
    return a.variantIndex - b.variantIndex;
  });

  const batches = groupByBatch(sorted);

  return (
    <aside className="run-list">
      <div className="run-list-header">
        <span>runs</span>
        <span className="run-list-count">{runs.length}</span>
      </div>
      {batches.length === 0 && (
        <div className="run-list-empty">
          no runs yet — fan out a prompt to start
        </div>
      )}
      {batches.map(({ batchId, runs: batchRuns }) => (
        <div key={batchId} className="batch">
          <div className="batch-label">
            <span className="batch-id">{batchId}</span>
            <span className="batch-size">×{batchRuns.length}</span>
          </div>
          {batchRuns.map((r) => (
            <button
              key={r.id}
              className={`run-item ${r.id === focusedRunId ? "focused" : ""} status-${r.status}`}
              onClick={() => onFocus(r.id === focusedRunId ? null : r.id)}
              title={r.prompt}
            >
              <StatusDot status={r.status} />
              <span className="run-item-idx">#{r.variantIndex}</span>
              <span className="run-item-label">{r.label}</span>
              {r.totals.costUsd > 0 && (
                <span className="run-item-cost">
                  ${r.totals.costUsd.toFixed(3)}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

function groupByBatch(runs: Run[]): { batchId: string; runs: Run[] }[] {
  const map = new Map<string, Run[]>();
  for (const r of runs) {
    const list = map.get(r.batchId) ?? [];
    list.push(r);
    map.set(r.batchId, list);
  }
  return [...map.entries()].map(([batchId, runs]) => ({ batchId, runs }));
}
