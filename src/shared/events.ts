// IPC channels + shared types for Chorus. Main ↔ renderer contract.

// ---------- IPC channel names ------------------------------------------------

export const IPC = {
  // Project / repo
  PickRepo: "chorus:pickRepo",
  GetState: "chorus:getState",

  // Fanout runs
  Fanout: "chorus:fanout",
  StopRun: "chorus:stopRun",
  StopAll: "chorus:stopAll",
  RemoveRun: "chorus:removeRun",

  // Promote / discard
  PromoteRun: "chorus:promoteRun",
  DiscardRun: "chorus:discardRun",

  // Events → renderer
  RunEvent: "chorus:runEvent",
  StateEvent: "chorus:stateEvent",
} as const;

// ---------- Project state ----------------------------------------------------

export interface ProjectState {
  repoPath: string | null;
  repoIsGit: boolean;
  baseBranch: string | null;
  runs: Run[];
}

// ---------- Runs -------------------------------------------------------------

export type RunStatus =
  | "pending" // worktree being created
  | "running" // claude subprocess alive
  | "done" // exited cleanly
  | "error" // exited with non-zero or parse failure
  | "aborted" // user hit stop
  | "promoted" // merged into base branch
  | "discarded"; // worktree removed

export interface Run {
  id: string;
  label: string; // short human label, defaults to first 40 chars of prompt
  prompt: string;
  variantIndex: number; // 0..count-1 within a fanout batch
  batchId: string; // fanout batch id — groups sibling runs
  model?: string;
  worktreePath: string;
  branch: string;
  status: RunStatus;
  sessionId?: string;
  items: TimelineItem[];
  totals: SessionTotals;
  startedAt: number;
  endedAt?: number;
  errorMessage?: string;
}

export interface SessionTotals {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  turns: number;
  durationMs: number;
}

export interface FanoutRequest {
  prompt: string;
  count: number;
  // If provided, one prompt per variant (fleet mode). Length must match count.
  variantPrompts?: string[];
  model?: string;
}

export interface FanoutResult {
  ok: boolean;
  batchId?: string;
  runIds?: string[];
  error?: string;
}

// ---------- Run events emitted to the renderer -------------------------------

export type RunEvent =
  | { kind: "run_created"; run: Run }
  | { kind: "status"; runId: string; status: RunStatus; errorMessage?: string }
  | { kind: "item"; runId: string; item: TimelineItem }
  | {
      kind: "patch";
      runId: string;
      id: string;
      patch: Partial<Extract<TimelineItem, { kind: "tool_call" }>>;
    }
  | { kind: "totals"; runId: string; totals: SessionTotals; sessionId?: string }
  | { kind: "stderr"; runId: string; text: string }
  | { kind: "removed"; runId: string };

// ---------- Timeline items (claude stream-json normalized) -------------------

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | Array<{ type: string; text?: string }>;
      is_error?: boolean;
    }
  | { type: "thinking"; thinking: string };

export type TimelineItem =
  | {
      kind: "session_start";
      id: string;
      sessionId: string;
      cwd?: string;
      model?: string;
      tools?: string[];
      timestamp: number;
    }
  | {
      kind: "assistant_text";
      id: string;
      text: string;
      model?: string;
      timestamp: number;
    }
  | {
      kind: "thinking";
      id: string;
      text: string;
      timestamp: number;
    }
  | {
      kind: "tool_call";
      id: string;
      toolUseId: string;
      name: string;
      input: Record<string, unknown>;
      result?: string;
      isError?: boolean;
      status: "running" | "done" | "error";
      timestamp: number;
    }
  | {
      kind: "user_text";
      id: string;
      text: string;
      timestamp: number;
    }
  | {
      kind: "result";
      id: string;
      success: boolean;
      durationMs?: number;
      costUsd?: number;
      numTurns?: number;
      text?: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadInputTokens?: number;
        cacheCreationInputTokens?: number;
      };
      timestamp: number;
    }
  | {
      kind: "unknown";
      id: string;
      raw: unknown;
      timestamp: number;
    };

// ---------- Raw claude stream-json shapes ------------------------------------

export interface AssistantMessage {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: ContentBlock[];
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface UserMessageRaw {
  role: "user";
  content: ContentBlock[];
}

export type StreamEvent =
  | {
      type: "system";
      subtype: "init";
      session_id: string;
      cwd?: string;
      model?: string;
      tools?: string[];
    }
  | {
      type: "assistant";
      message: AssistantMessage;
      session_id: string;
      parent_tool_use_id?: string | null;
    }
  | {
      type: "user";
      message: UserMessageRaw;
      session_id: string;
      parent_tool_use_id?: string | null;
    }
  | {
      type: "result";
      subtype: "success" | "error_max_turns" | "error_during_execution";
      session_id: string;
      duration_ms?: number;
      duration_api_ms?: number;
      is_error?: boolean;
      num_turns?: number;
      result?: string;
      total_cost_usd?: number;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }
  | {
      type: "unknown";
      raw: unknown;
    };

// ---------- Simple result envelopes ------------------------------------------

export interface OkResult {
  ok: true;
}
export interface ErrResult {
  ok: false;
  error: string;
}
export type Result = OkResult | ErrResult;
