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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // We cannot use the structured logger here because it depends on this config.
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment configuration:',
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
