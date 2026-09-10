import { Schema, model, Types, type HydratedDocument } from 'mongoose';
import { TICKET_PRIORITIES, type TicketPriority } from '../tickets/ticket.model.js';

export interface SlaTarget {
  firstResponseMins: number;
  resolutionMins: number;
}

export type SlaTargets = Record<TicketPriority, SlaTarget>;

// Sensible defaults applied when an organization has not customized its policy.
export const DEFAULT_SLA_TARGETS: SlaTargets = {
  URGENT: { firstResponseMins: 15, resolutionMins: 240 },
  HIGH: { firstResponseMins: 60, resolutionMins: 480 },
  MEDIUM: { firstResponseMins: 240, resolutionMins: 1440 },
  LOW: { firstResponseMins: 480, resolutionMins: 2880 },
};

export interface SlaPolicy {
  organizationId: Types.ObjectId;
  targets: SlaTargets;
  createdAt: Date;
  updatedAt: Date;
}

const targetSchema = new Schema<SlaTarget>(
  {
    firstResponseMins: { type: Number, required: true, min: 1 },
    resolutionMins: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const targetsSchemaDef = Object.fromEntries(
  TICKET_PRIORITIES.map((p) => [p, { type: targetSchema, required: true }]),
);

const slaPolicySchema = new Schema<SlaPolicy>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    targets: { type: new Schema(targetsSchemaDef, { _id: false }), required: true },
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
        return r;
      },
    },
  },
);

export type SlaPolicyDocument = HydratedDocument<SlaPolicy>;

export const SlaPolicyModel = model<SlaPolicy>('SlaPolicy', slaPolicySchema);
