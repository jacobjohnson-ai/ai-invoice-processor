import { STATUS } from "../format";
import type { Status } from "../types";

export default function StatusLabel({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`st ${s.tone}`}>{s.label}</span>;
}
