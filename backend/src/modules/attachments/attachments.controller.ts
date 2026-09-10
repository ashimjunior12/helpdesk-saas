import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createAttachment,
  deleteAttachment,
  getAttachmentForDownload,
  listAttachments,
} from './attachments.service.js';

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw AppError.badRequest('A file is required (field "file")');
  }
  const attachment = await createAttachment(
    req.user!.organizationId!,
    req.params.ticketId,
    req.user!.id,
    req.file,
  );
  res.status(201).json({ success: true, data: { attachment } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const attachments = await listAttachments(req.user!.organizationId!, req.params.ticketId);
  res.status(200).json({ success: true, data: { attachments } });
});

export const download = asyncHandler(async (req: Request, res: Response) => {
  const target = await getAttachmentForDownload(
    req.user!.organizationId!,
    req.params.ticketId,
    req.params.id,
  );
  res.setHeader('Content-Type', target.mimeType);
  // Force download rather than inline rendering (avoids stored-XSS via HTML/SVG).
  res.download(target.absolutePath, target.filename);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteAttachment(req.user!.organizationId!, req.params.ticketId, req.params.id);
  res.status(204).send();
});
