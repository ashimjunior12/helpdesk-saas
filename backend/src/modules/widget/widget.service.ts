import { randomBytes } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { CustomerModel } from '../customers/customer.model.js';
import { createTicket } from '../tickets/tickets.service.js';
import { WidgetConfigModel, type WidgetConfigDocument } from './widgetConfig.model.js';
import type { UpdateWidgetInput, WidgetTicketInput } from './widget.validation.js';

function newPublicKey(): string {
  return `wgt_${randomBytes(16).toString('hex')}`;
}

export async function getOrCreateConfig(organizationId: string): Promise<WidgetConfigDocument> {
  const existing = await WidgetConfigModel.findOne({ organizationId });
  if (existing) return existing;
  return WidgetConfigModel.create({ organizationId, publicKey: newPublicKey() });
}

export async function updateConfig(
  organizationId: string,
  input: UpdateWidgetInput,
): Promise<WidgetConfigDocument> {
  await getOrCreateConfig(organizationId);
  return WidgetConfigModel.findOneAndUpdate({ organizationId }, input, {
    new: true,
    runValidators: true,
  }) as Promise<WidgetConfigDocument>;
}

export async function rotateKey(organizationId: string): Promise<WidgetConfigDocument> {
  await getOrCreateConfig(organizationId);
  return WidgetConfigModel.findOneAndUpdate(
    { organizationId },
    { publicKey: newPublicKey() },
    { new: true },
  ) as Promise<WidgetConfigDocument>;
}

// Display settings for an embedded widget. Only non-sensitive fields, and only
// when the widget is enabled.
export interface PublicWidgetConfig {
  title: string;
  welcomeMessage: string;
  primaryColor: string;
}

export async function getPublicConfig(publicKey: string): Promise<PublicWidgetConfig> {
  const config = await WidgetConfigModel.findOne({ publicKey, enabled: true });
  if (!config) throw AppError.notFound('Widget not found');
  return {
    title: config.title,
    welcomeMessage: config.welcomeMessage,
    primaryColor: config.primaryColor,
  };
}

// Submits a ticket from the public widget. Returns only a minimal confirmation
// (never internal ticket fields) to an anonymous caller.
export async function submitWidgetTicket(
  publicKey: string,
  input: WidgetTicketInput,
): Promise<{ ticketNumber: number }> {
  const config = await WidgetConfigModel.findOne({ publicKey, enabled: true });
  if (!config) throw AppError.notFound('Widget not found');
  const organizationId = String(config.organizationId);

  const existing = await CustomerModel.findOne({ organizationId, email: input.email });
  const customerId = existing
    ? existing.id
    : (await CustomerModel.create({ organizationId, email: input.email, name: input.name })).id;

  const ticket = await createTicket(organizationId, '', {
    subject: input.subject,
    description: input.message,
    customerId,
  });
  return { ticketNumber: ticket.number };
}
