import pino from 'pino';
import { config } from '../config/index.js';

// Pretty, human-readable logs in development; structured JSON everywhere else.
const transport =
  !config.isProd && !config.isTest
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined;

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  transport,
  // Never write session tokens or passwords to the logs.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
    ],
    censor: '[redacted]',
  },
});
