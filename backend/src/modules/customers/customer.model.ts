import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface Customer {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<Customer>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
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
        return r;
      },
    },
  },
);

// A customer email is unique within an organization, not globally: two different
// tenants may each have a customer with the same email.
customerSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export type CustomerDocument = HydratedDocument<Customer>;

export const CustomerModel = model<Customer>('Customer', customerSchema);
