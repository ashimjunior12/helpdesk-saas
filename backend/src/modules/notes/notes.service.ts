import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { getTicket } from '../tickets/tickets.service.js';
import { SOCKET_EVENTS, emitToTicket } from '../../sockets/registry.js';
import { NoteModel, type NoteDocument } from './note.model.js';
import type { CreateNoteInput, ListNotesQuery } from './notes.validation.js';

interface ListResult {
  notes: NoteDocument[];
  total: number;
  page: number;
  limit: number;
}

// Adds a staff-only note to a ticket. The ticket is resolved tenant-scoped, so a
// ticket in another organization is unreachable (404). The note is always
// authored by the acting staff user.
export async function addNote(
  organizationId: string,
  ticketId: string,
  authorUserId: string,
  input: CreateNoteInput,
): Promise<NoteDocument> {
  const ticket = await getTicket(organizationId, ticketId);

  const note = await NoteModel.create({
    organizationId,
    ticketId: ticket.id,
    authorId: authorUserId,
    body: input.body,
  });

  logger.info(
    { operation: 'notes.create', organizationId, ticketId, noteId: note.id },
    'Note added',
  );
  emitToTicket(ticketId, SOCKET_EVENTS.NOTE_CREATED, note.toJSON());
  return note;
}

export async function listNotes(
  organizationId: string,
  ticketId: string,
  query: ListNotesQuery,
): Promise<ListResult> {
  await getTicket(organizationId, ticketId);

  const skip = (query.page - 1) * query.limit;
  const [notes, total] = await Promise.all([
    NoteModel.find({ ticketId }).sort({ createdAt: 1 }).skip(skip).limit(query.limit),
    NoteModel.countDocuments({ ticketId }),
  ]);

  return { notes, total, page: query.page, limit: query.limit };
}

export async function deleteNote(
  organizationId: string,
  ticketId: string,
  noteId: string,
): Promise<void> {
  await getTicket(organizationId, ticketId);

  const result = await NoteModel.deleteOne({ _id: noteId, ticketId, organizationId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Note not found');
  }
  logger.info({ operation: 'notes.delete', organizationId, ticketId, noteId }, 'Note deleted');
  emitToTicket(ticketId, SOCKET_EVENTS.NOTE_DELETED, { id: noteId, ticketId });
}
