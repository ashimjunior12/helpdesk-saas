import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

// Allowed status transitions. A transition not listed here is rejected.
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['PENDING', 'RESOLVED', 'CLOSED'],
  PENDING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export interface Ticket {
  organizationId: Types.ObjectId;
  number: number;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  customerId: Types.ObjectId;
  assignedAgentId: Types.ObjectId | null;
  teamId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<Ticket>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    number: { type: Number, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    status: { type: String, enum: TICKET_STATUSES, default: 'OPEN', index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'MEDIUM' },
    category: { type: String, trim: true, maxlength: 60 },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        r.id = String(r._id);
        delete r._id;
        r.organizationId = String(r.organizationId);
        r.customerId = String(r.customerId);
        r.assignedAgentId = r.assignedAgentId ? String(r.assignedAgentId) : null;
        r.teamId = r.teamId ? String(r.teamId) : null;
        return r;
      },
    },
  },
);

// Human-friendly ticket number is unique within an organization.
ticketSchema.index({ organizationId: 1, number: 1 }, { unique: true });

export type TicketDocument = HydratedDocument<Ticket>;

export const TicketModel = model<Ticket>('Ticket', ticketSchema);
