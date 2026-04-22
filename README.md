<div align="center">

# ✻ chorus

**Run many Claude Code agents in parallel. Pick the winner.**

One prompt. N isolated git worktrees. N Claude Code agents racing in parallel.
Promote the best result. Discard the rest.

<sub>Electron · React · TypeScript · git worktrees · Claude Code</sub>

</div>

---

## Why

Sometimes you want three shots at the same problem. Sometimes you want to give five agents five different tasks and watch them all run at once. Chorus is a tiny desktop cockpit for orchestrating that — every agent lives in its own git worktree, so their edits never collide, and you can merge the one you like with a single click.

## What it does

- **Fan out** one batch into `N` agents (1–8), each with its own task.
- **Isolate** every agent in a dedicated git worktree on a throwaway `chorus/<runId>` branch.
- **Stream** stdout from each `claude -p --output-format stream-json` subprocess into a per-agent timeline of thinking, tool calls, and edits.
- **Promote** the winner — merges the worktree branch back into base with `--no-ff`, preserves the branch.
- **Discard** the rest — force-removes the worktree and deletes the branch.
- **Stop** any run (or all of them) with a SIGTERM that lets claude flush a final result.

## Quickstart

```bash
git clone https://github.com/natedemoss/Chorus.git
cd Chorus
npm install
npm run dev
```

Requirements:

- Node 20+
- `claude` on your `PATH` ([install Claude Code](https://docs.claude.com/en/docs/claude-code))
- A git repository you'd like the agents to work in

Then: pick the repo, enter a distinct task in each of the N textareas, hit **Fan out →** (or Cmd/Ctrl+Enter).

## How it works

```
┌──────────────────────────────────────────────────────────┐
│  user picks repo   →   picks N, writes N tasks            │
└──────────────────────────────┬───────────────────────────┘
                               │ fanout
                               ▼
            ┌──────────────────────────────────┐
            │  RunManager (main process)        │
            │   - git worktree add × N          │
            │   - spawn `claude -p` × N         │
            │   - stream-json → timeline events │
            └──────────────────────────────────┘
              │         │         │         │
              ▼         ▼         ▼         ▼
          worktree  worktree  worktree  worktree
          agent #0  agent #1  agent #2  agent #3
```

Each agent runs with `--dangerously-skip-permissions` so it has the full tool surface (WebSearch, WebFetch, Bash, file edits). That sounds scary. It isn't — the blast radius is a throwaway worktree on a throwaway branch. Even a malicious agent can only wreck its own sandbox.

## Keyboard

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Fan out (when all tasks are filled) |
| `Cmd/Ctrl + K` | Command palette |
| `Esc` | Close palette / unfocus pane |

## Project layout

```
src/
  main/            Electron main process
    main.ts          app lifecycle + IPC wiring
    run.ts           RunManager — owns all active runs
    stream.ts        claude stream-json → TimelineItems
    worktree.ts      git worktree add / merge / remove
  preload/         contextBridge → window.chorus
  renderer/        React UI
    components/      TopBar, RunGrid, RunList, CommandPalette
    styles.css       Claude-themed tokens + components
  shared/
    events.ts        IPC + event schema
```

## Status

Alpha. It works on my Windows 11 machine, runs claude subprocesses without mangling prompts, streams their output cleanly, and has survived several dozen real fanouts. Use it, break it, tell me what broke.

## License

MIT — see [LICENSE](./LICENSE).
