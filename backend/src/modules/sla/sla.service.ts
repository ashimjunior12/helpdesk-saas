import { logger } from '../../utils/logger.js';
import { TicketModel, type TicketPriority } from '../tickets/ticket.model.js';
import { notifySlaBreach } from '../notifications/notifications.service.js';
import {
  DEFAULT_SLA_TARGETS,
  SlaPolicyModel,
  type SlaPolicyDocument,
  type SlaTargets,
} from './slaPolicy.model.js';

export async function getPolicy(organizationId: string): Promise<SlaPolicyDocument> {
  const existing = await SlaPolicyModel.findOne({ organizationId });
  if (existing) {
    return existing;
  }
  // Lazily materialize the default policy so every org has one to read/edit.
  return SlaPolicyModel.create({ organizationId, targets: DEFAULT_SLA_TARGETS });
}

export async function updatePolicy(
  organizationId: string,
  targets: SlaTargets,
): Promise<SlaPolicyDocument> {
  return SlaPolicyModel.findOneAndUpdate(
    { organizationId },
    { targets },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export interface DueDates {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}

export async function computeDueDates(
  organizationId: string,
  priority: TicketPriority,
  from: Date,
): Promise<DueDates> {
  const policy = await SlaPolicyModel.findOne({ organizationId });
  const targets = policy?.targets ?? DEFAULT_SLA_TARGETS;
  const target = targets[priority];
  return {
    firstResponseDueAt: new Date(from.getTime() + target.firstResponseMins * 60_000),
    resolutionDueAt: new Date(from.getTime() + target.resolutionMins * 60_000),
  };
}

// Marks newly breached SLA targets across all organizations and notifies the
// assignee. Written as a plain function so it can run from a scheduled BullMQ job
// (when Redis is configured) or be invoked directly in tests. Only unmet,
// still-open tickets past their due time are flagged, and each breach is flagged
// once (the boolean guard makes re-runs idempotent).
export async function evaluateSlaBreaches(now: Date = new Date()): Promise<{
  firstResponse: number;
  resolution: number;
}> {
  const firstResponseBreaches = await TicketModel.find({
    status: { $ne: 'CLOSED' },
    firstRespondedAt: null,
    firstResponseBreached: false,
    firstResponseDueAt: { $ne: null, $lt: now },
  });
  for (const ticket of firstResponseBreaches) {
    ticket.firstResponseBreached = true;
    await ticket.save();
    await notifySlaBreach(ticket, 'first response');
  }

  const resolutionBreaches = await TicketModel.find({
    status: { $ne: 'CLOSED' },
    resolvedAt: null,
    resolutionBreached: false,
    resolutionDueAt: { $ne: null, $lt: now },
  });
  for (const ticket of resolutionBreaches) {
    ticket.resolutionBreached = true;
    await ticket.save();
    await notifySlaBreach(ticket, 'resolution');
  }

  const result = { firstResponse: firstResponseBreaches.length, resolution: resolutionBreaches.length };
  if (result.firstResponse || result.resolution) {
    logger.info({ operation: 'sla.evaluate', ...result }, 'SLA breaches flagged');
  }
  return result;
}
