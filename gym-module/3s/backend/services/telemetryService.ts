import type { Request } from 'express';

interface TelemetryError extends Error {
  status: number;
  isOperational: boolean;
  cause?: unknown;
}

function initTelemetry(): false { return false; }
function captureError(_error: TelemetryError, _req: Request): void {}
async function flushTelemetry(): Promise<true> { return true; }

export { initTelemetry, captureError, flushTelemetry };
