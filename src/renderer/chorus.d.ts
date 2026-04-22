// Types for the window.chorus bridge injected by preload.

import type {
  FanoutRequest,
  FanoutResult,
  ProjectState,
  Result,
  RunEvent,
} from "../shared/events";

declare global {
  interface Window {
    chorus: {
      pickRepo: () => Promise<Result & { repoPath?: string }>;
      getState: () => Promise<ProjectState>;
      fanout: (req: FanoutRequest) => Promise<FanoutResult>;
      stopRun: (runId: string) => Promise<Result>;
      stopAll: () => Promise<Result>;
      removeRun: (runId: string) => Promise<Result>;
      promoteRun: (runId: string) => Promise<Result>;
      discardRun: (runId: string) => Promise<Result>;
      onRunEvent: (cb: (ev: RunEvent) => void) => () => void;
      onStateEvent: (cb: (state: ProjectState) => void) => () => void;
    };
  }
}

export {};
