import { afterEach, expect, test, vi } from 'vitest';
import config from '../../vite.config';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

test('the Node SEO renderer can read APP_URL without browser-only environment access', async () => {
  vi.stubEnv('APP_URL', 'https://server.example.test/');
  vi.stubGlobal('__ERP_PUBLIC_WEBSITE_URL__', undefined);
  vi.resetModules();
  const brand = await import('./brand');
  expect(brand.SERVICE_WEBSITE_URL).toBe('https://server.example.test');
});

test('unconfigured server-side metadata keeps relative URLs without a URL parsing error', async () => {
  vi.stubEnv('APP_URL', '');
  vi.stubGlobal('__ERP_PUBLIC_WEBSITE_URL__', undefined);
  vi.resetModules();
  const seo = await import('../seo/seo-config');
  expect(seo.resolveSeoUrl('/privacy-policy')).toBe('/privacy-policy');
});

test('exposes APP_URL to the frontend without forwarding server environment variables', async () => {
  vi.stubEnv('APP_URL', 'https://erp.example.test');
  vi.stubEnv('VITE_APP_URL', '');
  vi.stubEnv('SERVER_ONLY_TEST_SECRET', 'must-stay-on-server');
  const resolved = typeof config === 'function' ? await config({ mode: 'test', command: 'build' }) : config;
  expect(resolved.define).toEqual({ __ERP_PUBLIC_WEBSITE_URL__: '"https://erp.example.test"' });
  const htmlPlugin = resolved.plugins?.find(plugin => plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'public-website-url');
  if (!htmlPlugin || typeof htmlPlugin !== 'object' || !('transformIndexHtml' in htmlPlugin) || typeof htmlPlugin.transformIndexHtml !== 'function') throw new Error('Missing public URL HTML transform');
  expect(htmlPlugin.transformIndexHtml('<link href="%PUBLIC_WEBSITE_URL%/">', { path: '/', filename: 'index.html' })).toBe('<link href="https://erp.example.test/">');
});

test('allows a public frontend URL override while retaining the server APP_URL', async () => {
  vi.stubEnv('APP_URL', 'https://api.example.test');
  vi.stubEnv('VITE_APP_URL', 'https://web.example.test/');
  const resolved = typeof config === 'function' ? await config({ mode: 'test', command: 'build' }) : config;
  expect(resolved.define?.__ERP_PUBLIC_WEBSITE_URL__).toBe('"https://web.example.test/"');
  expect(process.env.APP_URL).toBe('https://api.example.test');
});
