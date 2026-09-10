import { Types } from 'mongoose';
import { TicketModel, TICKET_STATUSES, TICKET_PRIORITIES } from '../tickets/ticket.model.js';

type CountMap = Record<string, number>;

export interface AnalyticsOverview {
  totals: { tickets: number; open: number };
  byStatus: CountMap;
  byPriority: CountMap;
  sla: { firstResponseBreached: number; resolutionBreached: number };
  avgFirstResponseMs: number | null;
  avgResolutionMs: number | null;
  createdSeries: { date: string; count: number }[];
}

function toCountMap(rows: { _id: string; count: number }[], keys: readonly string[]): CountMap {
  const map: CountMap = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    if (row._id in map) map[row._id] = row.count;
  }
  return map;
}

// Computes dashboard metrics for one organization in a single aggregation.
export async function getOverview(organizationId: string, days: number): Promise<AnalyticsOverview> {
  const orgId = new Types.ObjectId(organizationId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [facet] = await TicketModel.aggregate([
    { $match: { organizationId: orgId } },
    {
      $facet: {
        total: [{ $count: 'count' }],
        open: [{ $match: { status: { $in: ['OPEN', 'PENDING'] } } }, { $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        sla: [
          {
            $group: {
              _id: null,
              firstResponseBreached: { $sum: { $cond: ['$firstResponseBreached', 1, 0] } },
              resolutionBreached: { $sum: { $cond: ['$resolutionBreached', 1, 0] } },
            },
          },
        ],
        firstResponse: [
          { $match: { firstRespondedAt: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: { $subtract: ['$firstRespondedAt', '$createdAt'] } } } },
        ],
        resolution: [
          { $match: { resolvedAt: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
        ],
        createdSeries: [
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const first = (arr: { count?: number; avg?: number }[]): { count?: number; avg?: number } =>
    arr[0] ?? {};

  return {
    totals: { tickets: first(facet.total).count ?? 0, open: first(facet.open).count ?? 0 },
    byStatus: toCountMap(facet.byStatus, TICKET_STATUSES),
    byPriority: toCountMap(facet.byPriority, TICKET_PRIORITIES),
    sla: {
      firstResponseBreached: facet.sla[0]?.firstResponseBreached ?? 0,
      resolutionBreached: facet.sla[0]?.resolutionBreached ?? 0,
    },
    avgFirstResponseMs: facet.firstResponse[0]?.avg ?? null,
    avgResolutionMs: facet.resolution[0]?.avg ?? null,
    createdSeries: facet.createdSeries.map((r: { _id: string; count: number }) => ({
      date: r._id,
      count: r.count,
    })),
  };
}
