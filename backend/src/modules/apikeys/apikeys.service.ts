import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { ApiKeyModel, type ApiKeyDocument } from './apiKey.model.js';

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreatedApiKey {
  apiKey: ApiKeyDocument;
  // The raw key, returned only once at creation.
  key: string;
}

export async function createApiKey(
  organizationId: string,
  createdById: string,
  name: string,
): Promise<CreatedApiKey> {
  const raw = `hlpk_${randomBytes(24).toString('hex')}`;
  const apiKey = await ApiKeyModel.create({
    organizationId,
    createdById,
    name,
    keyHash: hashKey(raw),
    prefix: raw.slice(0, 12),
  });
  logger.info({ operation: 'apikeys.create', organizationId, apiKeyId: apiKey.id }, 'API key created');
  return { apiKey, key: raw };
}

export function listApiKeys(organizationId: string): Promise<ApiKeyDocument[]> {
  return ApiKeyModel.find({ organizationId }).sort({ createdAt: -1 });
}

export async function revokeApiKey(organizationId: string, id: string): Promise<ApiKeyDocument> {
  const apiKey = await ApiKeyModel.findOneAndUpdate(
    { _id: id, organizationId },
    { revoked: true },
    { new: true },
  );
  if (!apiKey) throw AppError.notFound('API key not found');
  return apiKey;
}

// Resolves a raw key to its (active) record, or null. Updates lastUsedAt as a
// side effect (fire-and-forget).
export async function verifyApiKey(raw: string): Promise<ApiKeyDocument | null> {
  const apiKey = await ApiKeyModel.findOne({ keyHash: hashKey(raw), revoked: false });
  if (apiKey) {
    void ApiKeyModel.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).catch(() => undefined);
  }
  return apiKey;
}
