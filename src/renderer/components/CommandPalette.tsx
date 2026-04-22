import { useEffect, useMemo, useRef, useState } from "react";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette({
  onClose,
  onPickRepo,
  onStopAll,
  onDiscardLosers,
}: {
  onClose: () => void;
  onPickRepo: () => void;
  onStopAll: () => void;
  onDiscardLosers: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "pick-repo",
        label: "Pick a git repo",
        hint: "switch the working directory for all new runs",
        run: onPickRepo,
      },
      {
        id: "stop-all",
        label: "Stop all running runs",
        hint: "sends SIGTERM to every active claude subprocess",
        run: onStopAll,
      },
      {
        id: "discard-losers",
        label: "Discard losers",
        hint: "keep only promoted runs; discard the rest",
        run: onDiscardLosers,
      },
    ],
    [onDiscardLosers, onPickRepo, onStopAll],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setSelected(0), [query]);

  const runCmd = (cmd: Command) => {
    onClose();
    void cmd.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) runCmd(cmd);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette-list">
          {filtered.length === 0 && (
            <div className="palette-empty">no commands match</div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`palette-item ${i === selected ? "on" : ""}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => runCmd(cmd)}
            >
              <span className="palette-label">{cmd.label}</span>
              {cmd.hint && <span className="palette-hint">{cmd.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
