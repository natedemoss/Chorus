// RunManager — owns the set of active Runs. Handles:
//   - fanning out one prompt to N worktrees
//   - spawning `claude -p ...` subprocesses
//   - parsing stream-json → TimelineItems → events
//   - stop / promote / discard lifecycle

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as readline from "readline";
import type {
  FanoutRequest,
  Run,
  RunEvent,
  RunStatus,
  SessionTotals,
  TimelineItem,
} from "../shared/events";
import { StreamParser } from "./stream";
import {
  createWorktree,
  commitAll,
  mergeWorktreeBranch,
  removeWorktree,
} from "./worktree";

const emptyTotals = (): SessionTotals => ({
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  turns: 0,
  durationMs: 0,
});

interface RunInternal {
  run: Run;
  proc?: ChildProcess;
  parser: StreamParser;
}

// Claude's `-p` mode is a one-shot invocation: prompt in, stream out, exit.
// We run it with permission-mode acceptEdits so the agent can write files
// autonomously inside its isolated worktree.
const CLAUDE_BIN = process.env.CHORUS_CLAUDE_BIN ?? "claude";

export class RunManager extends EventEmitter {
  private runs = new Map<string, RunInternal>();
  private repoPath: string | null = null;
  private baseBranch: string | null = null;

  setRepo(repoPath: string | null, baseBranch: string | null): void {
    this.repoPath = repoPath;
    this.baseBranch = baseBranch;
  }

  listRuns(): Run[] {
    return [...this.runs.values()].map((r) => r.run);
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id)?.run;
  }

  async fanout(req: FanoutRequest): Promise<{ batchId: string; runIds: string[] }> {
    if (!this.repoPath) throw new Error("no repo selected");
    if (req.count < 1) throw new Error("count must be >= 1");
    if (req.variantPrompts && req.variantPrompts.length !== req.count) {
      throw new Error("variantPrompts length must match count");
    }

    const batchId = shortId();
    const runIds: string[] = [];

    for (let i = 0; i < req.count; i++) {
      const runId = `${batchId}-${i}`;
      const prompt = req.variantPrompts?.[i] ?? req.prompt;
      const run: Run = {
        id: runId,
        label: shortLabel(prompt),
        prompt,
        variantIndex: i,
        batchId,
        model: req.model,
        worktreePath: "",
        branch: "",
        status: "pending",
        items: [],
        totals: emptyTotals(),
        startedAt: Date.now(),
      };
      const internal: RunInternal = { run, parser: new StreamParser() };
      this.runs.set(runId, internal);
      runIds.push(runId);
      this.emit("event", { kind: "run_created", run } satisfies RunEvent);
    }

    // Create worktrees in parallel, then start each run as soon as its
    // worktree is ready. We await the whole batch so callers see a single
    // resolution, but each child run streams independently from here on.
    await Promise.all(runIds.map((id) => this.startRun(id)));

    return { batchId, runIds };
  }

  private async startRun(runId: string): Promise<void> {
    const internal = this.runs.get(runId);
    if (!internal || !this.repoPath) return;

    try {
      const { path: worktreePath, branch } = await createWorktree(
        this.repoPath,
        runId,
      );
      internal.run.worktreePath = worktreePath;
      internal.run.branch = branch;
      this.setStatus(runId, "running");
      this.spawnClaude(internal);
    } catch (e) {
      internal.run.errorMessage = (e as Error).message;
      this.setStatus(runId, "error", (e as Error).message);
    }
  }

  private spawnClaude(internal: RunInternal): void {
    const { run, parser } = internal;
    // Pipe the prompt via stdin rather than passing it as a -p argument.
    // On Windows, spawn with shell:true mangles args with spaces (the shell
    // re-tokenizes them), which truncated "fix the readme" to just "fix".
    // stdin sidesteps all shell escaping.
    // --dangerously-skip-permissions opens the full tool surface (WebSearch,
    // WebFetch, Bash, file writes) without prompts. The blast radius is
    // limited because each run is sandboxed to its own git worktree — even
    // a destructive agent only wrecks its own branch.
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (run.model) {
      args.push("--model", run.model);
    }

    const proc = spawn(CLAUDE_BIN, args, {
      cwd: run.worktreePath,
      shell: process.platform === "win32", // resolve claude.cmd on Windows
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    internal.proc = proc;

    if (proc.stdin) {
      // Swallow EPIPE in case claude exits before we finish writing.
      proc.stdin.on("error", () => {});
      proc.stdin.write(run.prompt);
      proc.stdin.end();
    }

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      const parsed = parser.parseLine(line);
      if (!parsed) return;
      for (const e of parsed.emits) {
        if (e.kind === "item") {
          run.items.push(e.item);
          this.applyItemToTotals(run, e.item);
          this.emit("event", { kind: "item", runId: run.id, item: e.item } satisfies RunEvent);
          if (e.item.kind === "session_start") {
            run.sessionId = e.item.sessionId;
            this.emit("event", {
              kind: "totals",
              runId: run.id,
              totals: run.totals,
              sessionId: run.sessionId,
            } satisfies RunEvent);
          } else if (e.item.kind === "result") {
            this.emit("event", {
              kind: "totals",
              runId: run.id,
              totals: run.totals,
            } satisfies RunEvent);
          }
        } else {
          // patch event — find & mutate the in-memory item.
          const idx = run.items.findIndex(
            (x) => x.kind === "tool_call" && x.id === e.id,
          );
          if (idx >= 0) {
            run.items[idx] = { ...run.items[idx], ...e.patch } as TimelineItem;
          }
          this.emit("event", {
            kind: "patch",
            runId: run.id,
            id: e.id,
            patch: e.patch,
          } satisfies RunEvent);
        }
      }
    });

    proc.stderr.on("data", (buf: Buffer) => {
      this.emit("event", {
        kind: "stderr",
        runId: run.id,
        text: buf.toString(),
      } satisfies RunEvent);
    });

    proc.on("error", (err) => {
      run.errorMessage = err.message;
      this.setStatus(run.id, "error", err.message);
    });

    proc.on("close", (code) => {
      run.endedAt = Date.now();
      // Don't overwrite an already-set terminal status (aborted / promoted / discarded).
      if (run.status === "running") {
        this.setStatus(run.id, code === 0 ? "done" : "error", code === 0 ? undefined : `claude exited ${code}`);
      }
    });
  }

  private applyItemToTotals(run: Run, item: TimelineItem): void {
    if (item.kind !== "result") return;
    run.totals.costUsd += item.costUsd ?? 0;
    run.totals.turns += item.numTurns ?? 0;
    run.totals.durationMs += item.durationMs ?? 0;
    if (item.usage) {
      run.totals.inputTokens += item.usage.inputTokens ?? 0;
      run.totals.outputTokens += item.usage.outputTokens ?? 0;
      run.totals.cacheReadTokens += item.usage.cacheReadInputTokens ?? 0;
      run.totals.cacheCreationTokens += item.usage.cacheCreationInputTokens ?? 0;
    }
  }

  private setStatus(runId: string, status: RunStatus, errorMessage?: string): void {
    const internal = this.runs.get(runId);
    if (!internal) return;
    internal.run.status = status;
    if (errorMessage) internal.run.errorMessage = errorMessage;
    this.emit("event", { kind: "status", runId, status, errorMessage } satisfies RunEvent);
  }

  stopRun(runId: string): void {
    const internal = this.runs.get(runId);
    if (!internal) return;
    if (internal.proc && internal.run.status === "running") {
      // SIGTERM is clean; claude subprocess catches it and flushes a result.
      try {
        internal.proc.kill();
      } catch {
        /* ignore */
      }
      this.setStatus(runId, "aborted");
    }
  }

  stopAll(): void {
    for (const id of this.runs.keys()) this.stopRun(id);
  }

  async promoteRun(runId: string): Promise<void> {
    const internal = this.runs.get(runId);
    if (!internal) throw new Error("run not found");
    if (!this.repoPath || !this.baseBranch) throw new Error("no repo/base branch");
    if (internal.run.status === "running") {
      throw new Error("run is still running — stop it first");
    }

    // Commit everything in the worktree so we have a branch to merge.
    await commitAll(internal.run.worktreePath, `chorus: run ${runId}`);
    await mergeWorktreeBranch(this.repoPath, internal.run.branch, this.baseBranch);
    // Remove the worktree after the merge — branch stays (merge commit
    // references it via -no-ff parent).
    await removeWorktree(this.repoPath, internal.run.worktreePath, internal.run.branch);
    this.setStatus(runId, "promoted");
  }

  async discardRun(runId: string): Promise<void> {
    const internal = this.runs.get(runId);
    if (!internal) throw new Error("run not found");
    if (!this.repoPath) throw new Error("no repo");
    if (internal.run.status === "running") this.stopRun(runId);
    await removeWorktree(this.repoPath, internal.run.worktreePath, internal.run.branch);
    this.setStatus(runId, "discarded");
  }

  removeRun(runId: string): void {
    const internal = this.runs.get(runId);
    if (!internal) return;
    if (internal.run.status === "running") this.stopRun(runId);
    this.runs.delete(runId);
    this.emit("event", { kind: "removed", runId } satisfies RunEvent);
  }

  shutdown(): void {
    this.stopAll();
  }
}

function shortId(): string {
  // 8 random hex chars, enough for human-scale fanout batches.
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
}

function shortLabel(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
}
