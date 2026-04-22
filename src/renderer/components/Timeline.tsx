import type { TimelineItem } from "../../shared/events";
import { ToolCallCard } from "./ToolCallCard";

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <>
      {items.map((item) => {
        switch (item.kind) {
          case "session_start":
            return (
              <div key={item.id} className="tl tl-session">
                <span className="tl-tag">session</span>
                {item.model && <span>{item.model}</span>}
              </div>
            );
          case "assistant_text":
            return (
              <div key={item.id} className="tl tl-assistant">
                <div className="tl-text">{item.text}</div>
              </div>
            );
          case "thinking":
            return (
              <div key={item.id} className="tl tl-thinking">
                <span className="tl-tag">thinking</span>
                <div className="tl-text">{item.text}</div>
              </div>
            );
          case "user_text":
            return (
              <div key={item.id} className="tl tl-user">
                <div className="tl-text">{item.text}</div>
              </div>
            );
          case "tool_call":
            return <ToolCallCard key={item.id} item={item} />;
          case "result":
            return (
              <div
                key={item.id}
                className={`tl tl-result ${item.success ? "ok" : "bad"}`}
              >
                <span className="tl-tag">{item.success ? "done" : "failed"}</span>
                {item.durationMs !== undefined && (
                  <span>{fmtMs(item.durationMs)}</span>
                )}
                {item.numTurns !== undefined && <span>{item.numTurns} turns</span>}
                {item.costUsd !== undefined && (
                  <span>${item.costUsd.toFixed(4)}</span>
                )}
              </div>
            );
          case "unknown":
            return (
              <div key={item.id} className="tl tl-unknown">
                <pre>
                  {typeof item.raw === "string"
                    ? item.raw
                    : JSON.stringify(item.raw, null, 2)}
                </pre>
              </div>
            );
        }
      })}
    </>
  );
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}
