import { Schema, model, Types, type HydratedDocument } from 'mongoose';

// Internal, staff-only note on a ticket. Kept in its own collection (never the
// messages collection) so a note can never be returned by a customer-facing
// message query.
export interface Note {
  organizationId: Types.ObjectId;
  ticketId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<Note>(
  {
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
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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

noteSchema.index({ ticketId: 1, createdAt: 1 });

export type NoteDocument = HydratedDocument<Note>;

export const NoteModel = model<Note>('Note', noteSchema);
