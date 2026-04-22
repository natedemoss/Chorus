import type { RunStatus } from "../../shared/events";

export function StatusDot({ status }: { status: RunStatus }) {
  return <span className={`sd sd-${status}`} title={status} />;
}
