import { useState } from "react";
import type { TimelineItem } from "../../shared/events";
import { DiffView, WriteDiffView } from "./DiffView";

type ToolCall = Extract<TimelineItem, { kind: "tool_call" }>;

export function ToolCallCard({ item }: { item: ToolCall }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeInput(item.name, item.input);
  const diff = renderDiff(item);

  return (
    <div className={`tl tl-tool status-${item.status}`}>
      <div className="tl-tool-head" onClick={() => setOpen((o) => !o)}>
        <span className={`sd sd-tool-${item.status}`} />
        <span className="tl-tool-name">{item.name}</span>
        <span className="tl-tool-sum">{summary}</span>
        <span className="tl-tool-chev">{open ? "▾" : "▸"}</span>
      </div>
      {diff && !open && <div className="tl-tool-body">{diff}</div>}
      {open && (
        <div className="tl-tool-body">
          {diff}
          <div>
            <div className="tl-section">input</div>
            <pre>{JSON.stringify(item.input, null, 2)}</pre>
          </div>
          {item.result !== undefined && (
            <div>
              <div className="tl-section">
                {item.isError ? "error" : "result"}
              </div>
              <pre className={item.isError ? "tl-err" : ""}>{item.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderDiff(item: ToolCall) {
  const input = item.input ?? {};
  if (item.name === "Edit") {
    const filePath = strOrUndef(input.file_path);
    const oldStr = strOrUndef(input.old_string);
    const newStr = strOrUndef(input.new_string);
    if (oldStr !== undefined && newStr !== undefined) {
      return <DiffView filePath={filePath} oldText={oldStr} newText={newStr} />;
    }
  }
  if (item.name === "Write") {
    const filePath = strOrUndef(input.file_path);
    const content = strOrUndef(input.content);
    if (content !== undefined) {
      return <WriteDiffView filePath={filePath} content={content} />;
    }
  }
  return null;
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function summarizeInput(name: string, input: Record<string, unknown>): string {
  if (!input || typeof input !== "object") return "";
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
      return String(input.file_path ?? "");
    case "Bash":
      return String(input.command ?? "").split("\n")[0] ?? "";
    case "Grep":
      return `"${input.pattern ?? ""}"${input.path ? ` in ${input.path}` : ""}`;
    case "Glob":
      return String(input.pattern ?? "");
    case "WebFetch":
    case "WebSearch":
      return String(input.url ?? input.query ?? "");
    default: {
      const first = Object.values(input)[0];
      if (typeof first === "string") return first.slice(0, 120);
      return "";
    }
  }
}
