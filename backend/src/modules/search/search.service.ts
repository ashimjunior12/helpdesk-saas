import type { FilterQuery } from 'mongoose';
import { escapeRegex } from '../../utils/escapeRegex.js';
import { TicketModel, type Ticket, type TicketDocument } from '../tickets/ticket.model.js';
import { CustomerModel, type CustomerDocument } from '../customers/customer.model.js';

interface SearchResult {
  tickets: TicketDocument[];
  customers: CustomerDocument[];
}

// Cross-entity quick search within an organization. Matches ticket
// subject/category (and ticket number when the term is numeric) and customer
// name/email, case-insensitively.
export async function search(
  organizationId: string,
  query: string,
  limit: number,
): Promise<SearchResult> {
  const rx = new RegExp(escapeRegex(query), 'i');

  const ticketOr: FilterQuery<Ticket>[] = [{ subject: rx }, { category: rx }];
  if (/^\d+$/.test(query)) {
    ticketOr.push({ number: Number(query) });
  }

  const [tickets, customers] = await Promise.all([
    TicketModel.find({ organizationId, $or: ticketOr }).sort({ createdAt: -1 }).limit(limit),
    CustomerModel.find({ organizationId, $or: [{ name: rx }, { email: rx }] })
      .sort({ createdAt: -1 })
      .limit(limit),
  ]);

  return { tickets, customers };
}
