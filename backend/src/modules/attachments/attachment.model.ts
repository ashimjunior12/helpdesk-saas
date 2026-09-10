import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface Attachment {
  organizationId: Types.ObjectId;
  ticketId: Types.ObjectId;
  uploadedById: Types.ObjectId;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<Attachment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Original client name (display only) vs the generated on-disk name.
    filename: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
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
        r.uploadedById = String(r.uploadedById);
        // Never expose the on-disk name to clients.
        delete r.storedName;
        return r;
      },
    },
  },
);

attachmentSchema.index({ ticketId: 1, createdAt: 1 });

export type AttachmentDocument = HydratedDocument<Attachment>;

export const AttachmentModel = model<Attachment>('Attachment', attachmentSchema);
