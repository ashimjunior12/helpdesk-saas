import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const USER_ROLES = ['ADMIN', 'MANAGER', 'AGENT'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  email: string;
  passwordHash: string;
  name: string;
  // Null until the user creates or joins an organization (Phase 2).
  organizationId: Types.ObjectId | null;
  role: UserRole | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    // Never selected by default; login opts in with .select('+passwordHash').
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
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
        delete r.passwordHash;
        return r;
      },
    },
  },
);

export type UserDocument = HydratedDocument<User>;

export const UserModel = model<User>('User', userSchema);
