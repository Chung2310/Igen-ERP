import { resolvePublicWebsiteUrl } from './publicWebsiteUrl';

// Vite replaces this public value in browser builds; the Node SEO renderer reads APP_URL.
declare const __ERP_PUBLIC_WEBSITE_URL__: string | undefined;

export const BRAND_NAME = "IGEN ERP";
export const BRAND_TAGLINE = "";

const configuredUrl = typeof __ERP_PUBLIC_WEBSITE_URL__ !== 'undefined'
  ? __ERP_PUBLIC_WEBSITE_URL__
  : typeof process !== 'undefined' ? process.env.APP_URL : undefined;
export const SERVICE_WEBSITE_URL = resolvePublicWebsiteUrl(configuredUrl, typeof window !== 'undefined' ? window.location.origin : '');
export const SUPPORT_EMAIL = "igen.work99@gmail.com";
export const SUPPORT_URL = `${SERVICE_WEBSITE_URL}/#phap-ly`;
export const PRIVACY_POLICY_URL = `${SERVICE_WEBSITE_URL}/privacy-policy`;
export const TERMS_OF_SERVICE_URL = `${SERVICE_WEBSITE_URL}/terms-of-service`;
export const USER_DATA_DELETION_URL = `${SERVICE_WEBSITE_URL}/user-data-deletion`;
export const BRAND_LOGO_PATH = "/brand-icon.png";
export const BRAND_FULL_LOGO_PATH = "/logo-igenerp.png";
export const BRAND_LOGO_URL = `${SERVICE_WEBSITE_URL}${BRAND_LOGO_PATH}`;
