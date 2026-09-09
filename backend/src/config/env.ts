import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment schema. Validation happens once, at startup, at the API boundary
 * of the process itself. If a required variable is missing or malformed we fail
 * fast with a clear message instead of crashing deep in business logic later.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Auth. Separate secrets for access and refresh tokens so a leaked access
  // secret cannot be used to forge long-lived refresh tokens. Required with a
  // minimum length so the process fails fast on weak/missing signing keys.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // Token lifetimes, expressed as vercel/ms-style durations (e.g. 15m, 7d).
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // We cannot use the structured logger here because it depends on this config.
  // eslint-disable-next-line no-console
  console.error(
    'Invalid environment configuration:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  /** CORS_ORIGIN may be a comma-separated list; expose it as an array. */
  corsOrigins: data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
} as const;

export type Env = typeof env;
