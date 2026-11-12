import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ findOne: vi.fn(), findOneAndUpdate: vi.fn() }));
vi.mock("../model/crm-ticket.model", () => ({
  CRMTicketModel: database,
}));

import { mapIntakeStandardFields, parseLeadIntakeAmount, upsertLeadFromIntake } from "./lead-intake.service";

describe("lead-intake.service helpers", () => {
  it("parses formatted VND budget strings into non-negative numeric amounts", () => {
    expect(parseLeadIntakeAmount("15,000,000")).toBe(15000000);
    expect(parseLeadIntakeAmount("500.000")).toBe(500000);
    expect(parseLeadIntakeAmount("1.500.000 đ")).toBe(1500000);
    expect(parseLeadIntakeAmount("1 500 000 VNĐ")).toBe(1500000);
    expect(parseLeadIntakeAmount("1.500,50 VND")).toBe(1500.5);
    expect(parseLeadIntakeAmount("0 ₫")).toBe(0);
    expect(parseLeadIntakeAmount("1.50.000")).toBeUndefined();
    expect(parseLeadIntakeAmount(" ")).toBeUndefined();
    expect(parseLeadIntakeAmount(" 250000 ")).toBe(250000);
    expect(parseLeadIntakeAmount("-500")).toBeUndefined();
    expect(parseLeadIntakeAmount("thỏa thuận")).toBeUndefined();
  });

  it("maps custom intake keys and Vietnamese labels back to core Lead aliases", () => {
    const mapped = mapIntakeStandardFields(
      [
        { key: "ho_ten", label: "Họ tên", type: "text" },
        { key: "sdt_khach", label: "SĐT", type: "phone" },
        { key: "email_lien_he", label: "Email", type: "email" },
        { key: "ten_cong_ty", label: "Tên công ty", type: "text" },
        { key: "nhu_cau", label: "Nhu cầu", type: "multi_select" },
        { key: "ngan_sach", label: "Ngân sách", type: "currency" },
      ],
      {
        ho_ten: "Trần Minh Quân",
        sdt_khach: "0909123456",
        email_lien_he: "quan@example.com",
        ten_cong_ty: "Công ty XYZ",
        nhu_cau: "Gói Doanh nghiệp",
        ngan_sach: "30,000,000",
      },
    );

    expect(mapped).toEqual({
      name: "Trần Minh Quân",
      phone: "0909123456",
      email: "quan@example.com",
      company: "Công ty XYZ",
      productOfChoice: "Gói Doanh nghiệp",
      value: "30,000,000",
    });
  });
});

describe("Lead intake writes", () => {
  const turn = {
    companyCode: "ACME",
    platform: "zalo" as const,
    accountId: "OA",
    conversationId: "CONVERSATION",
    profileId: "PROFILE",
    profileVersion: 1,
    fields: [
      { key: "name", label: "Họ tên", question: "Tên mình là gì ạ?" },
      { key: "phone", label: "SĐT", question: "Cho em xin SĐT ạ?" },
    ],
    values: { name: "An", phone: "0912345678" },
    previousValues: {},
    allowCreate: true,
    messageId: "ZALO-2",
    messageAt: new Date("2026-11-12T08:00:00Z"),
  };
  const read = (lead: unknown) => ({ select: () => ({ lean: async () => lead }) });

  beforeEach(() => {
    vi.resetAllMocks();
    database.findOne.mockReturnValue(read(null));
    database.findOneAndUpdate.mockReturnValue({ lean: async () => ({ _id: "LEAD" }) });
  });

  it("does not write empty turns, repeats or previously processed messages", async () => {
    await expect(upsertLeadFromIntake({ ...turn, values: {} })).resolves.toBeNull();
    const lead = { _id: "LEAD", answers: turn.values, intakeRevision: 2 };
    database.findOne.mockReturnValue(read(lead));
    await expect(upsertLeadFromIntake(turn)).resolves.toEqual(lead);
    database.findOne.mockReturnValue(read({ ...lead, lastIntakeMessageId: turn.messageId }));
    await upsertLeadFromIntake({ ...turn, values: { name: "Tên khác" } });
    expect(database.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("records the message id and the grouped answers together", async () => {
    await upsertLeadFromIntake(turn);
    expect(database.findOneAndUpdate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ companyCode: "ACME", sourcePlatform: "zalo", sourceAccountId: "OA", sourceConversationId: "CONVERSATION" }),
      expect.objectContaining({
        $set: expect.objectContaining({ answers: turn.values, lastIntakeMessageId: turn.messageId, collectionStatus: "complete" }),
        $inc: { intakeRevision: 1 },
      }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("retries a concurrent update against the latest Lead and preserves a staff deletion", async () => {
    database.findOne.mockReturnValueOnce(read({ _id: "LEAD", intakeRevision: 1, answers: { phone: "0900000000" } }))
      .mockReturnValueOnce(read({ _id: "LEAD", intakeRevision: 2, answers: {}, intakeStaffFields: ["answers.phone", "phone"] }));
    database.findOneAndUpdate.mockReturnValueOnce({ lean: async () => null });
    await upsertLeadFromIntake({ ...turn, previousValues: { phone: "0900000000" } });
    expect(database.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const [filter, update] = database.findOneAndUpdate.mock.calls[1];
    expect(filter).toMatchObject({ _id: "LEAD", intakeRevision: 2 });
    expect(update.$set).toHaveProperty(["answers.name"], "An");
    expect(update.$set).not.toHaveProperty(["answers.phone"]);
    expect(update.$set).not.toHaveProperty("phone");
  });

  it("fills only missing answers on a late retry without moving the Lead backwards", async () => {
    database.findOne.mockReturnValue(read({
      _id: "LEAD", intakeRevision: 3, answers: { name: "Tên mới" },
      lastIntakeMessageId: "ZALO-3", lastIntakeMessageAt: new Date("2026-11-12T08:01:00Z"),
    }));
    await upsertLeadFromIntake({ ...turn, preserveNewerValues: true });
    const [, update] = database.findOneAndUpdate.mock.calls[0];
    expect(update.$set).toHaveProperty(["answers.phone"], "0912345678");
    expect(update.$set).not.toHaveProperty(["answers.name"]);
    expect(update.$set).not.toHaveProperty("lastIntakeMessageId");
    expect(update.$set).not.toHaveProperty("lastIntakeMessageAt");
  });
});

