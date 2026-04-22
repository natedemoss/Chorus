// Normalize claude's --output-format stream-json lines into TimelineItems.
// Same shape as Coop's parser — mirrored here so Chorus has no cross-project
// dependencies. Keep in sync if claude's event schema shifts.

import type {
  StreamEvent,
  TimelineItem,
  AssistantMessage,
  UserMessageRaw,
  ContentBlock,
} from "../shared/events";

export type Emit =
  | { kind: "item"; item: TimelineItem }
  | {
      kind: "patch";
      id: string;
      patch: Partial<Extract<TimelineItem, { kind: "tool_call" }>>;
    };

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${seq++}`;

export class StreamParser {
  // Map from a tool_use id → the timeline item id we assigned to it, so the
  // later tool_result can patch the right card.
  private toolUseIdToItemId = new Map<string, string>();

  parseLine(line: string): { event: StreamEvent; emits: Emit[] } | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Non-JSON stdout from claude is usually startup noise or broken
      // output — drop rather than render as a debug card.
      return null;
    }
    const event = parsed as StreamEvent;
    return { event, emits: this.emitsFor(event) };
  }

  private emitsFor(event: StreamEvent): Emit[] {
    switch (event.type) {
      case "system":
        if (event.subtype === "init") {
          return [
            {
              kind: "item",
              item: {
                kind: "session_start",
                id: nextId("s"),
                sessionId: event.session_id,
                cwd: event.cwd,
                model: event.model,
                tools: event.tools,
                timestamp: Date.now(),
              },
            },
          ];
        }
        return [];

      case "assistant":
        return this.handleAssistant(event.message);

      case "user":
        return this.handleUser(event.message);

      case "result":
        return [
          {
            kind: "item",
            item: {
              kind: "result",
              id: nextId("r"),
              success: event.subtype === "success" && !event.is_error,
              durationMs: event.duration_ms,
              costUsd: event.total_cost_usd,
              numTurns: event.num_turns,
              text: event.result,
              usage: event.usage
                ? {
                    inputTokens: event.usage.input_tokens,
                    outputTokens: event.usage.output_tokens,
                    cacheReadInputTokens: event.usage.cache_read_input_tokens,
                    cacheCreationInputTokens:
                      event.usage.cache_creation_input_tokens,
                  }
                : undefined,
              timestamp: Date.now(),
            },
          },
        ];

      default:
        // Claude emits housekeeping events we don't render (rate_limit_event,
        // compact_boundary, etc.). Drop them silently rather than spamming
        // the timeline with raw JSON.
        return [];
    }
  }

  private handleAssistant(msg: AssistantMessage): Emit[] {
    const emits: Emit[] = [];
    for (const block of msg.content) {
      if (block.type === "text") {
        emits.push({
          kind: "item",
          item: {
            kind: "assistant_text",
            id: nextId("at"),
            text: block.text,
            model: msg.model,
            timestamp: Date.now(),
          },
        });
      } else if (block.type === "thinking") {
        emits.push({
          kind: "item",
          item: {
            kind: "thinking",
            id: nextId("t"),
            text: block.thinking,
            timestamp: Date.now(),
          },
        });
      } else if (block.type === "tool_use") {
        const itemId = nextId("tc");
        this.toolUseIdToItemId.set(block.id, itemId);
        emits.push({
          kind: "item",
          item: {
            kind: "tool_call",
            id: itemId,
            toolUseId: block.id,
            name: block.name,
            input: block.input,
            status: "running",
            timestamp: Date.now(),
          },
        });
      }
    }
    return emits;
  }

  private handleUser(msg: UserMessageRaw): Emit[] {
    const emits: Emit[] = [];
    for (const block of msg.content) {
      if (block.type === "tool_result") {
        const itemId = this.toolUseIdToItemId.get(block.tool_use_id);
        const resultText = blockResultToText(block.content);
        if (itemId) {
          emits.push({
            kind: "patch",
            id: itemId,
            patch: {
              result: resultText,
              isError: block.is_error ?? false,
              status: block.is_error ? "error" : "done",
            },
          });
        } else {
          // Result with no matching tool_use — rare but don't drop it.
          emits.push({
            kind: "item",
            item: {
              kind: "unknown",
              id: nextId("u"),
              raw: { orphan_tool_result: block },
              timestamp: Date.now(),
            },
          });
        }
      } else if (block.type === "text") {
        emits.push({
          kind: "item",
          item: {
            kind: "user_text",
            id: nextId("ut"),
            text: block.text,
            timestamp: Date.now(),
          },
        });
      }
    }
    return emits;
  }
}

function blockResultToText(
  content: ContentBlock extends infer B
    ? B extends { type: "tool_result"; content: infer C }
      ? C
      : never
    : never,
): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : (c.text ?? "")))
      .join("");
  }
  return "";
}
