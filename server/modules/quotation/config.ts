/** ERP owns environment loading, secrets and database connections. No QUOS auth/billing config. */
export const config = {
  get nodeEnv() { return process.env.NODE_ENV || "development"; },
  get openRouterApiKey() { return process.env.OPENROUTER_API_KEY || ""; },
  get openRouterModel() { return process.env.QUOTATION_AI_MODEL || process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash-0731"; },
  get openRouterFileModel() { return process.env.QUOTATION_FILE_MODEL || process.env.OPENROUTER_FILE_MODEL || "openai/gpt-4o-mini"; },
  get openRouterDocumentModel() { return process.env.QUOTATION_DOCUMENT_MODEL || process.env.OPENROUTER_DOCUMENT_MODEL || "anthropic/claude-opus-5.5"; },
  get openRouterSiteUrl() { return process.env.APP_URL || "http://localhost:3000"; },
  openRouterAppName: "iGen ERP Quotation",
  get cloudinary() { return { cloudName: process.env.CLOUDINARY_CLOUD_NAME || "", apiKey: process.env.CLOUDINARY_API_KEY || "", apiSecret: process.env.CLOUDINARY_API_SECRET || "" }; },
  get cloudinaryConfigured() { const value = this.cloudinary; return Boolean(value.cloudName && value.apiKey && value.apiSecret); },
  get taxRate() { const value = Number(process.env.QUOTATION_DEFAULT_TAX_RATE || 0); return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0; },
  get currency() { return process.env.QUOTATION_CURRENCY || "VND"; },
};
