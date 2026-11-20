import { inspect } from 'node:util';
import { APP_POLICY } from './env.js';

interface SanitizeOptions {
  maxDepth?: number;
  maxCollectionItems?: number;
  maxStringLength?: number;
  includeErrorStack?: boolean;
}

interface LogEntry {
  timestamp?: Date;
  level: string;
  context?: string;
  message: string;
  metadata?: unknown;
  timezone?: string;
}

const sensitiveKeys = /^(?:password|passwordhash|token|accesstoken|refreshtoken|authorization|cookie|apikey|secret|clientsecret|base64|imagebase64|sourceimage)$/i;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const defaultOptions = {
  maxDepth: APP_POLICY.LOG_MAX_DEPTH,
  maxCollectionItems: APP_POLICY.LOG_MAX_COLLECTION_ITEMS,
  maxStringLength: APP_POLICY.LOG_MAX_STRING_LENGTH,
  includeErrorStack: process.env.NODE_ENV !== 'production',
};

function sanitizeLogValue(value: unknown, options: SanitizeOptions = {}): unknown {
  const settings = { ...defaultOptions, ...options };
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number, key?: string): unknown => {
    if (key && sensitiveKeys.test(key)) return '[ĐÃ ẨN]';
    if (typeof current === 'string') {
      return current.length > settings.maxStringLength
        ? `${current.slice(0, settings.maxStringLength)}… [TRUNCATED]`
        : current;
    }
    if (current === null || typeof current !== 'object') return current;
    if (Buffer.isBuffer(current)) return `[Buffer: ${current.byteLength} bytes]`;
    if (current instanceof Date) return current.toISOString();
    if (seen.has(current)) return '[Circular]';
    if (depth >= settings.maxDepth) return '[TRUNCATED: max depth]';
    seen.add(current);

    if (current instanceof Error) {
      const result: Record<string, unknown> = { name: current.name, message: current.message };
      const code = (current as Error & { code?: unknown }).code;
      if (code !== undefined) result.code = code;
      if (settings.includeErrorStack && current.stack) result.stack = current.stack;
      return result;
    }
    if (Array.isArray(current)) {
      const items = current.slice(0, settings.maxCollectionItems).map((item) => visit(item, depth + 1));
      if (current.length > settings.maxCollectionItems) items.push(`[TRUNCATED: ${current.length - settings.maxCollectionItems} items]`);
      return items;
    }

    const entries = Object.entries(current as Record<string, unknown>).filter(([, entryValue]) => entryValue !== undefined);
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of entries.slice(0, settings.maxCollectionItems)) {
      result[entryKey] = visit(entryValue, depth + 1, entryKey);
    }
    if (entries.length > settings.maxCollectionItems) result['[TRUNCATED]'] = `${entries.length - settings.maxCollectionItems} fields`;
    return result;
  };

  try { return visit(value, 0); }
  catch { return '[Serialization failed]'; }
}

function formatTimestamp(date: Date, timezone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function formatLogLine({ timestamp = new Date(), level, context = 'Application', message, metadata, timezone }: LogEntry): string {
  const prefix = `[${formatTimestamp(timestamp, timezone)}] [${level.toLowerCase()}]: [${context}] ${message}`;
  if (metadata === undefined || metadata === null || (typeof metadata === 'object' && Object.keys(metadata).length === 0)) return prefix;
  const safe = sanitizeLogValue(metadata);
  const inspected = inspect(safe, { colors: false, depth: null, compact: true, breakLength: 100 });
  const multiline = inspected.startsWith('{ ') && inspected.endsWith(' }') ? `{\n  ${inspected.slice(2, -2)}\n}` : inspected;
  return `${prefix}\n${multiline}`;
}

export { formatLogLine, positiveInteger, sanitizeLogValue };
export type { LogEntry, SanitizeOptions };
