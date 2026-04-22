import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProjectState,
  Run,
  RunEvent,
  TimelineItem,
} from "../shared/events";
import { TopBar, type FanoutPayload } from "./components/TopBar";
import { RunGrid } from "./components/RunGrid";
import { RunList } from "./components/RunList";
import { CommandPalette } from "./components/CommandPalette";
import { WelcomeScreen } from "./components/WelcomeScreen";

export function App() {
  const [state, setState] = useState<ProjectState>({
    repoPath: null,
    repoIsGit: false,
    baseBranch: null,
    runs: [],
  });
  // runs are kept both on state (so the list view updates) and separately
  // here so incremental events don't have to rebuild the whole array.
  const [runs, setRuns] = useState<Map<string, Run>>(new Map());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Initial pull of state.
  useEffect(() => {
    if (!window.chorus) return;
    void window.chorus.getState().then((s) => {
      setState(s);
      setRuns(new Map(s.runs.map((r) => [r.id, r])));
    });
  }, []);

  // Subscribe to state + run events.
  useEffect(() => {
    if (!window.chorus) return;
    const offState = window.chorus.onStateEvent((s) => {
      setState(s);
      setRuns((prev) => {
        // Keep live item timelines from the map — state from main only
        // carries the snapshot at status-change time and can be stale mid-run.
        const next = new Map<string, Run>();
        for (const r of s.runs) {
          const existing = prev.get(r.id);
          next.set(r.id, existing ? { ...r, items: existing.items, totals: existing.totals } : r);
        }
        return next;
      });
    });

    const offEv = window.chorus.onRunEvent((ev: RunEvent) => {
      setRuns((prev) => {
        const next = new Map(prev);
        switch (ev.kind) {
          case "run_created":
            next.set(ev.run.id, ev.run);
            break;
          case "status": {
            const r = next.get(ev.runId);
            if (r)
              next.set(ev.runId, {
                ...r,
                status: ev.status,
                errorMessage: ev.errorMessage ?? r.errorMessage,
              });
            break;
          }
          case "item": {
            const r = next.get(ev.runId);
            if (r) next.set(ev.runId, { ...r, items: [...r.items, ev.item] });
            break;
          }
          case "patch": {
            const r = next.get(ev.runId);
            if (!r) break;
            const items = r.items.map((x) =>
              x.kind === "tool_call" && x.id === ev.id ? ({ ...x, ...ev.patch } as TimelineItem) : x,
            );
            next.set(ev.runId, { ...r, items });
            break;
          }
          case "totals": {
            const r = next.get(ev.runId);
            if (r)
              next.set(ev.runId, {
                ...r,
                totals: ev.totals,
                sessionId: ev.sessionId ?? r.sessionId,
              });
            break;
          }
          case "stderr":
            // Claude's stderr is usually startup noise or warnings, not
            // errors users need to see. Real errors arrive via the `result`
            // event or the process close handler, which sets status=error.
            break;
          case "removed":
            next.delete(ev.runId);
            break;
        }
        return next;
      });
    });

    return () => {
      offState();
      offEv();
    };
  }, []);

  // Cmd/Ctrl+K toggles palette, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (focusedRunId) setFocusedRunId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, focusedRunId]);

  const runList = useMemo(() => [...runs.values()], [runs]);

  const handlePickRepo = useCallback(async () => {
    const res = await window.chorus.pickRepo();
    if (!res.ok) setNotice(res.error);
    else setNotice(null);
  }, []);

  const handleFanout = useCallback(async (payload: FanoutPayload) => {
    const res = await window.chorus.fanout({
      prompt: payload.prompt,
      count: payload.count,
      variantPrompts: payload.variantPrompts,
    });
    if (!res.ok) setNotice(res.error ?? "fanout failed");
    else setNotice(null);
  }, []);

  const handleStopAll = useCallback(() => {
    void window.chorus.stopAll();
  }, []);

  const handleStop = useCallback((id: string) => void window.chorus.stopRun(id), []);

  const handlePromote = useCallback(async (id: string) => {
    const res = await window.chorus.promoteRun(id);
    if (!res.ok) setNotice(`promote failed: ${res.error}`);
  }, []);

  const handleDiscard = useCallback(async (id: string) => {
    const res = await window.chorus.discardRun(id);
    if (!res.ok) setNotice(`discard failed: ${res.error}`);
  }, []);

  const handleRemove = useCallback((id: string) => {
    void window.chorus.removeRun(id);
    setFocusedRunId((f) => (f === id ? null : f));
  }, []);

  const handleDiscardLosers = useCallback(() => {
    const survivors = runList.filter((r) => r.status === "promoted");
    if (survivors.length === 0) {
      setNotice("no promoted run yet — promote one first, then discard losers");
      return;
    }
    for (const r of runList) {
      if (r.status !== "promoted" && r.status !== "discarded") {
        void window.chorus.discardRun(r.id);
      }
    }
  }, [runList]);

  if (!window.chorus) {
    return (
      <div className="fatal">
        <div className="fatal-title">Chorus couldn't start</div>
        <div>window.chorus is missing — the preload bridge didn't load.</div>
      </div>
    );
  }

  const repoReady = !!state.repoPath && state.repoIsGit;

  return (
    <div className="app">
      <TopBar
        repoPath={state.repoPath}
        baseBranch={state.baseBranch}
        repoReady={repoReady}
        onPickRepo={handlePickRepo}
        onFanout={handleFanout}
        onStopAll={handleStopAll}
        runningCount={runList.filter((r) => r.status === "running").length}
      />
      {notice && (
        <div className="notice">
          {notice}
          <button className="notice-x" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
      {!repoReady ? (
        <WelcomeScreen onPickRepo={handlePickRepo} />
      ) : (
        <div className="workspace">
          <RunList
            runs={runList}
            focusedRunId={focusedRunId}
            onFocus={setFocusedRunId}
          />
          <RunGrid
            runs={runList}
            focusedRunId={focusedRunId}
            onFocus={setFocusedRunId}
            onStop={handleStop}
            onPromote={handlePromote}
            onDiscard={handleDiscard}
            onRemove={handleRemove}
          />
        </div>
      )}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onPickRepo={handlePickRepo}
          onStopAll={handleStopAll}
          onDiscardLosers={handleDiscardLosers}
        />
      )}
    </div>
  );
}
