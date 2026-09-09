import { Schema, model, type HydratedDocument } from 'mongoose';

export interface Organization {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<Organization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
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
        return r;
      },
    },
  },
);

export type OrganizationDocument = HydratedDocument<Organization>;

export const OrganizationModel = model<Organization>('Organization', organizationSchema);
