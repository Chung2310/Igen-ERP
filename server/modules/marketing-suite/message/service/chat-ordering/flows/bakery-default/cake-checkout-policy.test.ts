import { describe, expect, it } from "vitest";
import { resolveCakeDepositPolicy } from "./cake-checkout-policy";

describe("cake deposit policy", () => {
  it("requests the configured deposit from a new customer", () => {
    expect(resolveCakeDepositPolicy({ depositEnabled: true, depositPercent: 30, returningCustomer: false, customerRequestedWaiver: false }))
      .toEqual({ depositPercent: 30, depositWaiverReason: undefined });
  });

  it("waives deposit for a returning customer when deposits are enabled", () => {
    expect(resolveCakeDepositPolicy({ depositEnabled: true, depositPercent: 30, returningCustomer: true, customerRequestedWaiver: false }))
      .toEqual({ depositPercent: 0, depositWaiverReason: "returning_customer" });
  });

  it("respects a customer's request not to pay a deposit", () => {
    expect(resolveCakeDepositPolicy({ depositEnabled: true, depositPercent: 30, returningCustomer: false, customerRequestedWaiver: true }))
      .toEqual({ depositPercent: 0, depositWaiverReason: "customer_requested" });
  });

  it("does not require a deposit when the company has disabled it", () => {
    expect(resolveCakeDepositPolicy({ depositEnabled: false, depositPercent: 30, returningCustomer: false, customerRequestedWaiver: false }))
      .toEqual({ depositPercent: 0, depositWaiverReason: undefined });
  });
});
