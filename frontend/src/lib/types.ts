export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT';
export type OrgRole = 'ADMIN' | 'MANAGER' | 'AGENT';
export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AuthUser {
  id: string;
  email: string;
  organizationId: string | null;
  role: Role | null;
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  customerId: string;
  assignedAgentId: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  ticketId: string;
  authorType: 'AGENT' | 'CUSTOMER';
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Note {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  ticketId: string | null;
  ticketNumber: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AnalyticsOverview {
  totals: { tickets: number; open: number };
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  sla: { firstResponseBreached: number; resolutionBreached: number };
  avgFirstResponseMs: number | null;
  avgResolutionMs: number | null;
  createdSeries: { date: string; count: number }[];
}
