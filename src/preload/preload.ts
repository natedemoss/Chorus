import { contextBridge, ipcRenderer } from "electron";

// Channel strings mirror src/shared/events.ts. Duplicated here so preload
// has no cross-dir imports (which failed silently in earlier Electron setups).
const IPC = {
  PickRepo: "chorus:pickRepo",
  GetState: "chorus:getState",
  Fanout: "chorus:fanout",
  StopRun: "chorus:stopRun",
  StopAll: "chorus:stopAll",
  RemoveRun: "chorus:removeRun",
  PromoteRun: "chorus:promoteRun",
  DiscardRun: "chorus:discardRun",
  RunEvent: "chorus:runEvent",
  StateEvent: "chorus:stateEvent",
} as const;

const api = {
  pickRepo: () => ipcRenderer.invoke(IPC.PickRepo),
  getState: () => ipcRenderer.invoke(IPC.GetState),
  fanout: (req: unknown) => ipcRenderer.invoke(IPC.Fanout, req),
  stopRun: (runId: string) => ipcRenderer.invoke(IPC.StopRun, runId),
  stopAll: () => ipcRenderer.invoke(IPC.StopAll),
  removeRun: (runId: string) => ipcRenderer.invoke(IPC.RemoveRun, runId),
  promoteRun: (runId: string) => ipcRenderer.invoke(IPC.PromoteRun, runId),
  discardRun: (runId: string) => ipcRenderer.invoke(IPC.DiscardRun, runId),
  onRunEvent: (cb: (ev: unknown) => void) => {
    const l = (_: unknown, ev: unknown) => cb(ev);
    ipcRenderer.on(IPC.RunEvent, l);
    return () => ipcRenderer.removeListener(IPC.RunEvent, l);
  },
  onStateEvent: (cb: (state: unknown) => void) => {
    const l = (_: unknown, state: unknown) => cb(state);
    ipcRenderer.on(IPC.StateEvent, l);
    return () => ipcRenderer.removeListener(IPC.StateEvent, l);
  },
};

contextBridge.exposeInMainWorld("chorus", api);

export type ChorusApi = typeof api;
