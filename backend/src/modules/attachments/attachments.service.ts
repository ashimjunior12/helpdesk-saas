import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { uploadDir } from '../../middleware/upload.js';
import { getTicket } from '../tickets/tickets.service.js';
import { AttachmentModel, type AttachmentDocument } from './attachment.model.js';

interface UploadedFile {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
}

export async function createAttachment(
  organizationId: string,
  ticketId: string,
  uploadedById: string,
  file: UploadedFile,
): Promise<AttachmentDocument> {
  // Confirm the ticket is in the caller's org before recording the file. If it
  // is not, remove the just-written file so we do not leave an orphan on disk.
  try {
    await getTicket(organizationId, ticketId);
  } catch (err) {
    await fs.rm(path.join(uploadDir, file.filename), { force: true });
    throw err;
  }

  const attachment = await AttachmentModel.create({
    organizationId,
    ticketId,
    uploadedById,
    filename: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
  });
  logger.info(
    { operation: 'attachments.create', organizationId, ticketId, attachmentId: attachment.id },
    'Attachment uploaded',
  );
  return attachment;
}

export async function listAttachments(
  organizationId: string,
  ticketId: string,
): Promise<AttachmentDocument[]> {
  await getTicket(organizationId, ticketId);
  return AttachmentModel.find({ ticketId, organizationId }).sort({ createdAt: 1 });
}

export interface DownloadTarget {
  absolutePath: string;
  filename: string;
  mimeType: string;
}

export async function getAttachmentForDownload(
  organizationId: string,
  ticketId: string,
  attachmentId: string,
): Promise<DownloadTarget> {
  await getTicket(organizationId, ticketId);
  const attachment = await AttachmentModel.findOne({ _id: attachmentId, ticketId, organizationId });
  if (!attachment) {
    throw AppError.notFound('Attachment not found');
  }
  return {
    // basename guards against any traversal in the stored name.
    absolutePath: path.join(uploadDir, path.basename(attachment.storedName)),
    filename: attachment.filename,
    mimeType: attachment.mimeType,
  };
}

export async function deleteAttachment(
  organizationId: string,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await getTicket(organizationId, ticketId);
  const attachment = await AttachmentModel.findOneAndDelete({
    _id: attachmentId,
    ticketId,
    organizationId,
  });
  if (!attachment) {
    throw AppError.notFound('Attachment not found');
  }
  await fs.rm(path.join(uploadDir, path.basename(attachment.storedName)), { force: true });
  logger.info(
    { operation: 'attachments.delete', organizationId, ticketId, attachmentId },
    'Attachment deleted',
  );
}
