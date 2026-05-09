import type { ParcelStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_PILL_CLASS } from "@/lib/derive";

export function StatusPill({ status }: { status: ParcelStatus }) {
  return <span className={`status-pill ${STATUS_PILL_CLASS[status]}`}>{STATUS_LABELS[status]}</span>;
}
