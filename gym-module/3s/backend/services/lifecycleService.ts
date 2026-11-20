import type { Server } from 'node:http';
import type { AppLogger } from '../config/logger.js';

interface ShutdownDependencies {
  server?: Pick<Server, 'close'>;
  disconnect: () => Promise<unknown>;
  flush: () => Promise<unknown>;
  exit: (code: number) => void;
  logger: Pick<AppLogger, 'info' | 'fatal'>;
  timeoutMs?: number;
}

function createShutdown({ server, disconnect, flush, exit, logger, timeoutMs = 10000 }: ShutdownDependencies) {
  let shutdownPromise: Promise<void> | undefined;
  return function shutdown(signal: string, exitCode = 0): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = new Promise<void>((resolve) => {
      let finished = false;
      const finish = async () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { await disconnect(); await flush(); logger.info({ signal }, 'Đã dừng dịch vụ an toàn'); }
        catch (error) { logger.fatal({ err: error, signal }, 'Lỗi khi dừng dịch vụ'); exitCode = 1; }
        exit(exitCode);
        resolve();
      };
      const timer = setTimeout(() => {
        logger.fatal({ signal }, 'Quá thời gian dừng dịch vụ');
        if (server && typeof (server as { closeAllConnections?: () => void }).closeAllConnections === 'function') {
          (server as { closeAllConnections?: () => void }).closeAllConnections?.();
        }
        finish();
      }, timeoutMs);
      if (server?.close) {
        if (typeof (server as { closeIdleConnections?: () => void }).closeIdleConnections === 'function') {
          (server as { closeIdleConnections?: () => void }).closeIdleConnections?.();
        }
        server.close(finish);
      } else {
        finish();
      }
    });
    return shutdownPromise;
  };
}

export { createShutdown };
