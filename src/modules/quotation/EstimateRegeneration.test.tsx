// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Quote } from "./types";
const client = vi.hoisted(() => ({ api: vi.fn(), canAi: true }));
vi.mock("./api", () => ({ api: client.api, hasQuotationCapability: () => client.canAi }));
import EstimateRegeneration from "./EstimateRegeneration";

const quote = { _id: "6aed00000000000000000001", updatedAt: "2026-11-06T00:00:00.000Z" } as Quote;
const answers = { "Câu hỏi bổ sung: Số lượng?": "5 cái" };
const props = () => ({ quote, answers, hasOtherChanges: false, busy: false, confirm: vi.fn().mockResolvedValue(true), onBusy: vi.fn(), onUpdated: vi.fn().mockResolvedValue(undefined) });
describe("regenerate estimate from answers", () => {
  beforeEach(() => { vi.clearAllMocks(); client.canAi = true; });
  afterEach(cleanup);
  it("confirms before sending the current answers and exact loaded revision", async () => {
    client.api.mockResolvedValue({ quote }); const input = props();
    render(<EstimateRegeneration {...input} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(input.onUpdated).toHaveBeenCalled());
    expect(input.confirm).toHaveBeenCalledOnce();
    expect(client.api).toHaveBeenCalledWith(`/api/quotes/${quote._id}/recalculate`, expect.objectContaining({ headers: { "If-Unmodified-Since": quote.updatedAt }, body: JSON.stringify({ additionalInformation: answers }) }));
    expect(input.onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it("shows an inline error and leaves the answers available for retry", async () => {
    client.api.mockRejectedValueOnce(new Error("AI chưa khả dụng")).mockResolvedValueOnce({ quote }); const input = props();
    render(<EstimateRegeneration {...input} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "AI chưa khả dụng");
    expect(input.onUpdated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(input.onUpdated).toHaveBeenCalled());
    expect(client.api.mock.calls[1][1].body).toBe(client.api.mock.calls[0][1].body);
  });
  it("blocks without answers, AI permission, or with other unsaved edits", () => {
    const input = props(); const view = render(<EstimateRegeneration {...input} answers={{}} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<EstimateRegeneration {...input} hasOtherChanges />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    client.canAi = false; view.rerender(<EstimateRegeneration {...input} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(client.api).not.toHaveBeenCalled();
  });
  it("does not call AI when confirmation is cancelled", async () => {
    const input = props(); input.confirm.mockResolvedValue(false);
    render(<EstimateRegeneration {...input} />); fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(input.confirm).toHaveBeenCalled());
    expect(client.api).not.toHaveBeenCalled();
  });
});
