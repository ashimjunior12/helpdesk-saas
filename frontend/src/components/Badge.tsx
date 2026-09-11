import type { TicketPriority, TicketStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`badge badge-${priority}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}
