// Thin wrapper over `git worktree`. Each run gets an isolated checkout under
// <repo>/.chorus/worktrees/<runId> on branch chorus/<runId>, so parallel
// runs can't stomp on each other's files.

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";

export interface WorktreeInfo {
  path: string;
  branch: string;
}

export async function ensureGitRepo(repoPath: string): Promise<boolean> {
  try {
    await run(repoPath, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export async function currentBranch(repoPath: string): Promise<string | null> {
  try {
    const out = await run(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    return out.trim() || null;
  } catch {
    return null;
  }
}

export async function createWorktree(
  repoPath: string,
  runId: string,
): Promise<WorktreeInfo> {
  const worktreesDir = path.join(repoPath, ".chorus", "worktrees");
  await fs.mkdir(worktreesDir, { recursive: true });

  const worktreePath = path.join(worktreesDir, runId);
  const branch = `chorus/${runId}`;

  // `git worktree add -b <branch> <path>` branches off the current HEAD.
  // Parallel runs may race to create the worktrees dir — mkdir above is safe,
  // and git itself serializes worktree adds per repo lock.
  await run(repoPath, ["worktree", "add", "-b", branch, worktreePath]);

  return { path: worktreePath, branch };
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
): Promise<void> {
  // --force in case files are dirty; we're about to discard anyway.
  try {
    await run(repoPath, ["worktree", "remove", "--force", worktreePath]);
  } catch {
    // If git already lost track of it, just wipe the dir.
    await fs.rm(worktreePath, { recursive: true, force: true });
  }
  try {
    await run(repoPath, ["branch", "-D", branch]);
  } catch {
    // Branch may already be gone (e.g. if it was merged and auto-deleted).
  }
}

export async function mergeWorktreeBranch(
  repoPath: string,
  branch: string,
  baseBranch: string,
): Promise<void> {
  // Switch to base branch, then merge the run's branch with --no-ff so the
  // provenance of "this came from a chorus run" stays visible in history.
  await run(repoPath, ["checkout", baseBranch]);
  await run(repoPath, ["merge", "--no-ff", "-m", `chorus: promote ${branch}`, branch]);
}

export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const out = await run(worktreePath, ["status", "--porcelain"]);
  return out.trim().length > 0;
}

// Stage + commit everything in the worktree. Chorus runs with
// --permission-mode acceptEdits, so the agent writes straight to disk
// without committing. We snapshot the whole worktree into a single commit
// at promote time so `git merge <branch>` has something to merge.
export async function commitAll(
  worktreePath: string,
  message: string,
): Promise<boolean> {
  const dirty = await hasUncommittedChanges(worktreePath);
  if (!dirty) return false;
  await run(worktreePath, ["add", "-A"]);
  await run(worktreePath, [
    "-c",
    "user.email=chorus@local",
    "-c",
    "user.name=Chorus",
    "commit",
    "-m",
    message,
  ]);
  return true;
}

function run(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, shell: false });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`git ${args.join(" ")} failed (${code}): ${err.trim()}`));
    });
  });
}
