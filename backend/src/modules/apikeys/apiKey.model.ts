import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface ApiKey {
  organizationId: Types.ObjectId;
  name: string;
  // SHA-256 of the raw key; the raw key is shown to the user only once.
  keyHash: string;
  prefix: string;
  createdById: Types.ObjectId;
  lastUsedAt: Date | null;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<ApiKey>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    keyHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastUsedAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
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
        r.createdById = String(r.createdById);
        // The hash is a secret-equivalent; never expose it.
        delete r.keyHash;
        return r;
      },
    },
  },
);

export type ApiKeyDocument = HydratedDocument<ApiKey>;

export const ApiKeyModel = model<ApiKey>('ApiKey', apiKeySchema);
