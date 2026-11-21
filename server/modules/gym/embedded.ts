import type { Express, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function mountEmbeddedGym(app: Express): void {
  let gymApp: RequestHandler | undefined;
  let readyPromise: Promise<RequestHandler | undefined> | undefined;
  const secret = process.env.GYM_BRIDGE_SECRET?.trim();

  if (secret && secret.length >= 32) {
    const file = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'gym-module', '3s', 'dist', 'backend', 'embedded.js')
      : path.join(process.cwd(), 'gym-module', '3s', 'backend', 'embedded.ts');
    readyPromise = import(pathToFileURL(file).href)
      .then((module) => module.startEmbeddedGym())
      .then((loadedApp) => {
        gymApp = loadedApp as RequestHandler;
        return gymApp;
      })
      .catch((error) => {
        console.error('[gym] Failed to start embedded Gym:', error);
        return undefined;
      });
  }

  app.use('/internal-gym', async (request, response, next) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress || '')) {
      return response.status(404).end();
    }
    if (!gymApp && readyPromise) {
      await readyPromise;
    }
    if (!gymApp) return response.status(503).json({ message: 'Quản lý phòng Gym chưa sẵn sàng.' });
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    try {
      if (!secret || secret.length < 32) throw new Error('Gym bridge is not configured.');
      jwt.verify(token, secret, { issuer: 'igen-erp', audience: 'chuoi-gym', algorithms: ['HS256'] });
    } catch {
      return response.status(403).end();
    }
    return gymApp(request, response, next);
  });
}
