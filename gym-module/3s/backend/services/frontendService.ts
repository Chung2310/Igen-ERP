import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import type { ViteDevServer } from 'vite';

type CreateViteServer = typeof import('vite')['createServer'];

interface FrontendOptions {
  mode?: string;
  createViteServer?: CreateViteServer;
}

function registerFrontend(app: Express, frontendPath: string, options: FrontendOptions = {}): Promise<ViteDevServer | boolean> {
  const mode = options.mode || process.env.NODE_ENV || 'development';
  if (mode !== 'production') {
    const configFile = path.resolve(frontendPath, '../vite.config.ts');
    const viteReady = options.createViteServer
      ? options.createViteServer({ root: frontendPath, configFile: fs.existsSync(configFile) ? configFile : undefined, appType: 'spa', server: { middlewareMode: true } })
      : import('vite').then(({ createServer }) => createServer({ root: frontendPath, configFile: fs.existsSync(configFile) ? configFile : undefined, appType: 'spa', server: { middlewareMode: true } }));
    app.use(async (req, res, next) => {
      try { const vite = await viteReady; return vite.middlewares(req, res, next); }
      catch (error) { return next(error); }
    });
    return viteReady;
  }
  if (!fs.existsSync(path.join(frontendPath, 'index.html'))) return Promise.resolve(false);
  app.use(express.static(frontendPath));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
  return Promise.resolve(true);
}

export { registerFrontend };
