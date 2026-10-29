// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

test('legal links, SEO and the embedded Marketing module use the configured website', async () => {
  vi.stubGlobal('__ERP_PUBLIC_WEBSITE_URL__', ' https://erp.example.test/ ');
  vi.resetModules();
  const brand = await import('./brand');
  const marketing = await import('../modules/marketing-suite/shared/config/brand');
  const seo = await import('../seo/seo-config');
  expect(brand.PRIVACY_POLICY_URL).toBe('https://erp.example.test/privacy-policy');
  expect(brand.TERMS_OF_SERVICE_URL).toBe('https://erp.example.test/terms-of-service');
  expect(brand.USER_DATA_DELETION_URL).toBe('https://erp.example.test/user-data-deletion');
  expect(marketing.SERVICE_WEBSITE_URL).toBe(brand.SERVICE_WEBSITE_URL);
  expect(seo.SEO_BASE_URL).toBe(brand.SERVICE_WEBSITE_URL);
});

test.each(['', 'javascript:alert(1)', 'invalid-domain', 'https://user:password@example.test'])('keeps legal links on the current website for invalid or absent config: %s', async value => {
  vi.stubGlobal('__ERP_PUBLIC_WEBSITE_URL__', value);
  vi.resetModules();
  const brand = await import('./brand');
  expect(brand.SERVICE_WEBSITE_URL).toBe(window.location.origin);
  expect(brand.PRIVACY_POLICY_URL).toBe(`${window.location.origin}/privacy-policy`);
});
