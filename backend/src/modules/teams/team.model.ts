import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface Team {
  organizationId: Types.ObjectId;
  name: string;
  memberIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<Team>(
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
    memberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
        r.memberIds = (r.memberIds as Types.ObjectId[]).map((m) => String(m));
        return r;
      },
    },
  },
);

// Team names are unique within an organization (not globally across tenants).
teamSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export type TeamDocument = HydratedDocument<Team>;

export const TeamModel = model<Team>('Team', teamSchema);
