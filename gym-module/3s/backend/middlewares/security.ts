import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export interface SecurityOptions {
  corsOrigins: string[];
  trustProxy: boolean | number | string;
  jsonBodyLimit: string;
}

export function configureSecurity(app: Application, options: SecurityOptions): void {
  if (options.trustProxy !== false) app.set('trust proxy', options.trustProxy);

  const isDevelopment = process.env.NODE_ENV !== 'production';
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://static.cloudflareinsights.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'https://cloudflareinsights.com'],
        fontSrc: ["'self'", 'https:', 'data:'],
      },
    },
  }));

  app.use(cors({
    origin(origin, callback) {
      if (!origin || isDevelopment || options.corsOrigins.length === 0 || options.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Nguồn truy cập không được phép.' }));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: options.jsonBodyLimit }));
  app.use(express.urlencoded({ limit: options.jsonBodyLimit, extended: true }));
}
