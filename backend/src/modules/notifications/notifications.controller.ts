import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from './notifications.service.js';
import { listNotificationsQuerySchema } from './notifications.validation.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listNotificationsQuerySchema.parse(req.query);
  const { notifications, total, page, limit } = await listNotifications(
    req.user!.organizationId!,
    req.user!.id,
    query,
  );
  res.status(200).json({
    success: true,
    data: {
      notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await unreadCount(req.user!.organizationId!, req.user!.id);
  res.status(200).json({ success: true, data: { count } });
});

export const readOne = asyncHandler(async (req: Request, res: Response) => {
  const notification = await markRead(req.user!.organizationId!, req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: { notification } });
});

export const readAll = asyncHandler(async (req: Request, res: Response) => {
  const updated = await markAllRead(req.user!.organizationId!, req.user!.id);
  res.status(200).json({ success: true, data: { updated } });
});
