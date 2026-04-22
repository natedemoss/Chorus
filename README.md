<div align="center">

# chorus

### The desktop cockpit for running many Claude Code agents at once.

**One window. N isolated git worktrees. N agents working in parallel. You pick the winner.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg?logo=node.js&logoColor=white)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?logo=electron&logoColor=white)]()
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)]()
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite&logoColor=white)]()
[![Claude Code](https://img.shields.io/badge/Claude%20Code-required-D97706.svg)](https://docs.claude.com/en/docs/claude-code)

<sub>Electron · React · TypeScript · git worktrees · Claude Code</sub>

</div>

---

## What is Chorus?

**Chorus is an interface for running multiple Claude Code agents in parallel — without them stepping on each other.**

Instead of opening five terminals, juggling five branches, and praying nothing collides, Chorus gives you one panel where you:

1. Pick a repo.
2. Choose how many agents you want (1–8).
3. Give each one a task.
4. Hit **Fan out →**.

Each agent gets its own throwaway git worktree on its own throwaway branch, so they can edit, install, run, and break things in complete isolation. You watch their thinking, tool calls, and edits stream in real time. When one of them nails it, you click **Promote** — Chorus merges it back into your base branch with `--no-ff`. The losers get force-removed with one click.

> **Think of it as `tmux` for Claude Code, but git-aware.**

---

## Why you'd want this

| Use case | What you do |
|---|---|
| **Three shots at the same problem** | Same prompt × 3 agents → keep the best implementation |
| **A/B/C/D experiments** | Try four different approaches at once, compare results side-by-side |
| **Parallel chores** | Five unrelated tasks (refactor X, write tests for Y, fix bug Z…) running concurrently |
| **Spec exploration** | One agent writes the API, one writes tests, one writes docs — all from the same starting point |
| **Risk-free experimentation** | Every agent is sandboxed in a worktree — your main branch is untouched until you promote |

---

## Features

- **Fan-out orchestration** — one click spawns N Claude Code subprocesses, each with their own task
- **Git worktree isolation** — every agent lives on its own `chorus/<runId>` branch in its own working directory
- **Live streaming UI** — `claude -p --output-format stream-json` parsed into a per-agent timeline of thinking, tool calls, and file edits
- **One-click promote** — merges the winner back into base with `--no-ff`, branch preserved for history
- **One-click discard** — force-removes the worktree and deletes the branch
- **Graceful stop** — SIGTERM lets `claude` flush a final result before exiting (per-agent or all at once)
- **Keyboard-first** — `Cmd/Ctrl + Enter` to fan out, `Cmd/Ctrl + K` for the command palette

---

## Quickstart

```bash
git clone https://github.com/natedemoss/Chorus.git
cd Chorus
npm install
npm run dev
```

**Requirements:**

| | |
|---|---|
| Node | `>= 20` |
| Claude Code | `claude` on your `PATH` — [install guide](https://docs.claude.com/en/docs/claude-code) |
| Git | A repository you'd like the agents to work in |

Then: pick the repo, write a distinct task in each of the N textareas, and hit **Fan out →** (or `Cmd/Ctrl + Enter`).

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│  user picks repo   →   picks N, writes N tasks           │
└──────────────────────────────┬───────────────────────────┘
                               │ fanout
                               ▼
            ┌──────────────────────────────────┐
            │  RunManager (main process)       │
            │   • git worktree add × N         │
            │   • spawn `claude -p` × N        │
            │   • stream-json → timeline events│
            └──────────────────────────────────┘
              │         │         │         │
              ▼         ▼         ▼         ▼
          worktree  worktree  worktree  worktree
          agent #0  agent #1  agent #2  agent #3
```

Each agent runs with `--dangerously-skip-permissions` so it has the full tool surface (WebSearch, WebFetch, Bash, file edits).

> **That sounds scary. It isn't.** The blast radius is a throwaway worktree on a throwaway branch. Even a malicious agent can only wreck its own sandbox — your main branch and working tree are untouched until *you* hit promote.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Fan out (when all tasks are filled) |
| `Cmd/Ctrl + K` | Open command palette |
| `Esc` | Close palette / unfocus pane |

---

## Project layout

```
src/
  main/              Electron main process
    main.ts            app lifecycle + IPC wiring
    run.ts             RunManager — owns all active runs
    stream.ts          claude stream-json → TimelineItems
    worktree.ts        git worktree add / merge / remove
  preload/           contextBridge → window.chorus
  renderer/          React UI
    components/        TopBar, RunGrid, RunList, CommandPalette
    styles.css         Claude-themed tokens + components
  shared/
    events.ts          IPC + event schema
```

---

## Status

**Alpha.** It works on my Windows 11 machine, runs `claude` subprocesses without mangling prompts, streams their output cleanly, and has survived several dozen real fanouts.

Use it. Break it. [Open an issue](https://github.com/natedemoss/Chorus/issues) and tell me what broke.

---

## License

MIT — see [LICENSE](./LICENSE).

<div align="center">
<sub>Built for people who want more than one shot at a problem.</sub>
</div>
