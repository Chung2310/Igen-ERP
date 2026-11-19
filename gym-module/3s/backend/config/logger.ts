import winston from 'winston';
import { formatLogLine, sanitizeLogValue } from './logFormatter.js';

type LogMetadata = Record<string, unknown>;
type LogMethod = (metadataOrMessage: LogMetadata | string, message?: string) => void;

interface AppLogger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  child(metadata: LogMetadata): AppLogger;
  flush(): Promise<void>;
}

const defaultLevel = process.env.NODE_ENV === 'test' ? 'silent' : process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function createAppLogger(baseMetadata: LogMetadata = {}): AppLogger {
  const core = winston.createLogger({
    level: defaultLevel,
    levels: { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, silent: 99 },
    transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
    format: winston.format.printf((info) => formatLogLine({
      timestamp: info.timestamp instanceof Date ? info.timestamp : new Date(),
      level: info.level,
      context: typeof info.context === 'string' ? info.context : 'Application',
      message: String(info.message),
      metadata: info.metadata,
    })),
  });

  const write = (level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): LogMethod => (metadataOrMessage, message) => {
    const metadata = typeof metadataOrMessage === 'string' ? baseMetadata : { ...baseMetadata, ...metadataOrMessage };
    const text = typeof metadataOrMessage === 'string' ? metadataOrMessage : message || '';
    const context = typeof metadata.context === 'string' ? metadata.context : level === 'fatal' ? 'Fatal' : 'Application';
    const { context: _context, ...details } = metadata;
    core.log(level, text, { context, metadata: sanitizeLogValue(details) });
  };

  return {
    debug: write('debug'), info: write('info'), warn: write('warn'), error: write('error'), fatal: write('fatal'),
    child(metadata) { return createAppLogger({ ...baseMetadata, ...metadata }); },
    async flush() { await new Promise<void>((resolve) => setImmediate(resolve)); },
  };
}

const logger = createAppLogger();

export { createAppLogger, logger };
export type { AppLogger, LogMetadata, LogMethod };
