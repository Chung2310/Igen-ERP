export function resolvePublicWebsiteUrl(configured?: string, currentOrigin = '') {
  for (const candidate of [configured, currentOrigin]) {
    if (!candidate?.trim()) continue;
    try {
      const url = new URL(candidate.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch { /* Fall back to same-site links when the public URL is absent or invalid. */ }
  }
  return '';
}
