# Contributing to chorus

Happy to have you. Chorus is small and opinionated — the goal is a tight, focused cockpit for running parallel Claude Code agents, not a general-purpose agent framework.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` starts three concurrent processes:

- `vite` on `http://localhost:5173` (renderer HMR)
- `tsc -w` for the main process (`dist-main/`)
- `electron .` once both are ready

## Typecheck

```bash
npm run typecheck
```

Runs both `tsconfig.json` (renderer) and `tsconfig.main.json` (main) with `--noEmit`. CI-style gate before PRs.

## Architecture at a glance

- **Main process** (`src/main/`) owns all state and side effects: spawning claude, managing git worktrees, parsing stream-json.
- **Renderer** (`src/renderer/`) is pure display. It holds a `Map<runId, Run>` mirror of main's state and updates incrementally from IPC events.
- **Preload** (`src/preload/`) exposes a minimal, typed `window.chorus` API via `contextBridge`.
- **Shared** (`src/shared/events.ts`) is the single source of truth for IPC shapes, Run/TimelineItem types, and stream event schemas.

The renderer never touches the filesystem, git, or claude directly. If you need a new capability, add an IPC method in `events.ts`, wire it in `main.ts`, expose it in `preload/index.ts`, and consume it in the renderer.

## Conventions

- **TypeScript strict mode.** No `any` in new code.
- **No runtime dependencies** beyond React. We keep the tree small on purpose.
- **Comments explain *why*, not *what*.** If a comment would just restate the code, delete it.
- **Windows is a first-class target.** Remember: `shell: true` on Windows retokenizes args (that's why we pipe prompts via stdin).

## What makes a good PR

- A single, focused change. If you want to refactor and add a feature, send two PRs.
- Typecheck passes.
- If the change is user-visible, a sentence in the PR description describing what the user sees.
- If you added a new file, explain in the PR why it couldn't live in an existing one.

## What's out of scope (for now)

- Non-claude agent backends. Chorus is intentionally specialized.
- Persistence of runs across restarts. Runs are ephemeral.
- Multi-repo workspaces. One repo at a time.

If you want any of these, open an issue first so we can talk about it before you build it.

## Bugs

Open an issue with:

- OS + Node version
- What you did (repo state, tasks entered, N)
- What you expected
- What happened (copy any stderr from the devtools console)

Thanks for helping.
