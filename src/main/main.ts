import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import {
  IPC,
  type FanoutRequest,
  type FanoutResult,
  type ProjectState,
  type Result,
  type RunEvent,
} from "../shared/events";
import { RunManager } from "./run";
import { currentBranch, ensureGitRepo } from "./worktree";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
const runs = new RunManager();
let repoPath: string | null = null;
let baseBranch: string | null = null;
let repoIsGit = false;

function currentState(): ProjectState {
  return {
    repoPath,
    repoIsGit,
    baseBranch,
    runs: runs.listRuns(),
  };
}

function broadcastState(): void {
  mainWindow?.webContents.send(IPC.StateEvent, currentState());
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#000000",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "..", "dist-renderer", "index.html"),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    runs.shutdown();
  });
}

async function setRepo(next: string | null): Promise<void> {
  repoPath = next;
  repoIsGit = next ? await ensureGitRepo(next) : false;
  baseBranch = next && repoIsGit ? await currentBranch(next) : null;
  runs.setRepo(repoPath, baseBranch);
  broadcastState();
}

app.whenReady().then(() => {
  createWindow();

  runs.on("event", (ev: RunEvent) => {
    mainWindow?.webContents.send(IPC.RunEvent, ev);
    // Status-changing events update state too (list view shows counts).
    if (
      ev.kind === "status" ||
      ev.kind === "run_created" ||
      ev.kind === "removed"
    ) {
      broadcastState();
    }
  });

  ipcMain.handle(IPC.GetState, (): ProjectState => currentState());

  ipcMain.handle(IPC.PickRepo, async (): Promise<Result & { repoPath?: string }> => {
    if (!mainWindow) return { ok: false, error: "no window" };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Pick a git repo to run chorus against",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: "canceled" };
    }
    const picked = result.filePaths[0];
    await setRepo(picked);
    if (!repoIsGit) {
      return {
        ok: false,
        error: "that folder isn't a git repo — chorus needs one to create worktrees",
        repoPath: picked,
      };
    }
    return { ok: true, repoPath: picked };
  });

  ipcMain.handle(
    IPC.Fanout,
    async (_evt, req: FanoutRequest): Promise<FanoutResult> => {
      if (!repoPath || !repoIsGit) {
        return { ok: false, error: "no git repo selected" };
      }
      try {
        const { batchId, runIds } = await runs.fanout(req);
        return { ok: true, batchId, runIds };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

  ipcMain.handle(IPC.StopRun, (_evt, runId: string): Result => {
    runs.stopRun(runId);
    return { ok: true };
  });

  ipcMain.handle(IPC.StopAll, (): Result => {
    runs.stopAll();
    return { ok: true };
  });

  ipcMain.handle(IPC.RemoveRun, (_evt, runId: string): Result => {
    runs.removeRun(runId);
    return { ok: true };
  });

  ipcMain.handle(IPC.PromoteRun, async (_evt, runId: string): Promise<Result> => {
    try {
      await runs.promoteRun(runId);
      broadcastState();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(IPC.DiscardRun, async (_evt, runId: string): Promise<Result> => {
    try {
      await runs.discardRun(runId);
      broadcastState();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  runs.shutdown();
  if (process.platform !== "darwin") app.quit();
});
