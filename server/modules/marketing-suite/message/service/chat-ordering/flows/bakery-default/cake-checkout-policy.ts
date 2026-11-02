export type CakeDepositWaiverReason = "returning_customer" | "customer_requested";

export function resolveCakeDepositPolicy(input: {
  depositEnabled: boolean; depositPercent: number; returningCustomer: boolean; customerRequestedWaiver: boolean;
}) {
  const waived = input.customerRequestedWaiver || input.returningCustomer || !input.depositEnabled;
  const depositWaiverReason: CakeDepositWaiverReason | undefined = input.customerRequestedWaiver
    ? "customer_requested" : input.returningCustomer && input.depositEnabled ? "returning_customer" : undefined;
  return { depositPercent: waived ? 0 : input.depositPercent, depositWaiverReason };
}
