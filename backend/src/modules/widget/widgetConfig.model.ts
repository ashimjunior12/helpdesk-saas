import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface WidgetConfig {
  organizationId: Types.ObjectId;
  // Public, non-secret key safe to embed in a website. Identifies the org for the
  // widget and only allows creating tickets / reading display settings.
  publicKey: string;
  title: string;
  welcomeMessage: string;
  primaryColor: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const widgetConfigSchema = new Schema<WidgetConfig>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    publicKey: { type: String, required: true, unique: true },
    title: { type: String, default: 'Contact support', maxlength: 80 },
    welcomeMessage: {
      type: String,
      default: 'Send us a message and we will get back to you by email.',
      maxlength: 300,
    },
    primaryColor: { type: String, default: '#2563eb' },
    enabled: { type: Boolean, default: true },
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

export type WidgetConfigDocument = HydratedDocument<WidgetConfig>;

export const WidgetConfigModel = model<WidgetConfig>('WidgetConfig', widgetConfigSchema);
