import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getOrCreateConfig,
  getPublicConfig,
  rotateKey,
  submitWidgetTicket,
  updateConfig,
} from './widget.service.js';
import type { UpdateWidgetInput, WidgetTicketInput } from './widget.validation.js';

// Admin (JWT) endpoints
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await getOrCreateConfig(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { config } });
});

export const putConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await updateConfig(req.user!.organizationId!, req.body as UpdateWidgetInput);
  res.status(200).json({ success: true, data: { config } });
});

export const postRotate = asyncHandler(async (req: Request, res: Response) => {
  const config = await rotateKey(req.user!.organizationId!);
  res.status(200).json({ success: true, data: { config } });
});

// Public (unauthenticated) endpoints keyed by the embeddable public key
export const publicConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await getPublicConfig(req.params.publicKey);
  res.status(200).json({ success: true, data: { config } });
});

export const publicSubmit = asyncHandler(async (req: Request, res: Response) => {
  const result = await submitWidgetTicket(req.params.publicKey, req.body as WidgetTicketInput);
  res.status(201).json({ success: true, data: result });
});
