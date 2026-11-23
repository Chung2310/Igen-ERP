/** Validate email syntax and domain structure without a public-TLD allowlist.
 * Company/internal/test domains are valid addresses; no DNS lookup is implied. */
export const EMAIL_ADDRESS_OPTIONS = { tlds: { allow: false }, minDomainSegments: 2 } as const;
