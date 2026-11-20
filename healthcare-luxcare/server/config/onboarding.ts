// Legacy configuration enables invitation infrastructure only; it never opens public signup.
export function organizationInvitationsConfigured(): boolean {
  const configured = process.env.ORGANIZATION_INVITATIONS_ENABLED;
  return configured === undefined ? process.env.PUBLIC_REGISTRATION_ENABLED === "true" : configured === "true";
}
