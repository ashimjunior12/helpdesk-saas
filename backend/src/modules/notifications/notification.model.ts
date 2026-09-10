import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'TICKET_ASSIGNED',
  'TICKET_MESSAGE',
  'TICKET_STATUS',
  'SLA_BREACH',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  organizationId: Types.ObjectId;
  // Recipient of the notification.
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  ticketId: Types.ObjectId | null;
  ticketNumber: number | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
    ticketNumber: { type: Number, default: null },
    isRead: { type: Boolean, default: false },
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
        r.userId = String(r.userId);
        r.ticketId = r.ticketId ? String(r.ticketId) : null;
        return r;
      },
    },
  },
);

// A user's notifications, newest first, and unread lookups.
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationModel = model<Notification>('Notification', notificationSchema);
