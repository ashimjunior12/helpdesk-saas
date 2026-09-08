import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Single application-wide structured logger.
 *
 * In development we pretty-print for readability; in production/test we emit
 * newline-delimited JSON so log aggregators can parse it. We redact anything
 * that could carry secrets (passwords, tokens, auth headers) so sensitive data
 * never reaches the logs.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
});

export type Logger = typeof logger;
