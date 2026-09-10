import { CustomerModel } from '../customers/customer.model.js';
import { createTicket } from '../tickets/tickets.service.js';
import type { TicketDocument } from '../tickets/ticket.model.js';
import type { PublicTicketInput } from './public.validation.js';

// Finds a customer by email within the org, creating one if none exists, so
// external callers can raise a ticket by email without pre-creating customers.
async function findOrCreateCustomer(
  organizationId: string,
  email: string,
  name: string,
): Promise<string> {
  const existing = await CustomerModel.findOne({ organizationId, email });
  if (existing) return existing.id;
  const created = await CustomerModel.create({ organizationId, email, name });
  return created.id;
}

export async function createPublicTicket(
  organizationId: string,
  input: PublicTicketInput,
): Promise<TicketDocument> {
  const customerId = await findOrCreateCustomer(
    organizationId,
    input.customer.email,
    input.customer.name,
  );
  // No acting user for API-created tickets; automation/SLA still apply.
  return createTicket(organizationId, '', {
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    category: input.category,
    customerId,
  });
}
