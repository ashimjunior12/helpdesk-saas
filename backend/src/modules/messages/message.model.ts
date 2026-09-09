import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const MESSAGE_AUTHOR_TYPES = ['AGENT', 'CUSTOMER'] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

export interface Message {
  organizationId: Types.ObjectId;
  ticketId: Types.ObjectId;
  // AGENT -> authorId is a User; CUSTOMER -> authorId is the ticket's Customer.
  authorType: MessageAuthorType;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<Message>(
  {
    // Denormalized from the ticket for tenant-scoped indexing and defense in depth.
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    authorType: { type: String, enum: MESSAGE_AUTHOR_TYPES, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
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
        r.ticketId = String(r.ticketId);
        r.authorId = String(r.authorId);
        return r;
      },
    },
  },
);

// Messages are listed per ticket in chronological order.
messageSchema.index({ ticketId: 1, createdAt: 1 });

export type MessageDocument = HydratedDocument<Message>;

export const MessageModel = model<Message>('Message', messageSchema);
