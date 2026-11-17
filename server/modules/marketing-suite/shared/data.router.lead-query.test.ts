import type { IRoute, NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { suiteDataRouter } from "./data.router";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { UserModel } from "../../../model/user.model";

const state = vi.hoisted(() => ({
  findFilter: {} as Record<string, unknown>,
  sortExpr: "",
  permissions: ["omni-inbox:read"],
  rows: [] as Array<Record<string, unknown>>,
  create: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  requirePermission: (permission: string | string[]) => (_req: Request, res: Response, next: NextFunction) =>
    [permission].flat().some(value => state.permissions.includes(value)) ? next() : res.status(403).json({ status: "error" }),
}));

vi.mock("../message/model/crm-ticket.model", () => ({
  CRMTicketModel: {
    create: state.create,
    findOne: state.findOne,
    find: (filter: Record<string, unknown>) => {
      state.findFilter = filter;
      return {
        sort: (expr: string) => {
          state.sortExpr = expr;
          return {
            skip: () => ({
              limit: () => ({
                lean: async () => state.rows,
              }),
            }),
          };
        },
      };
    },
    countDocuments: async () => state.rows.length,
  },
}));

type RuntimeRoute = IRoute & { methods: Record<string, boolean> };

function requestLeads(method: "get" | "post", query: Record<string, string>, body: Record<string, unknown> = {}, path = "/omni-inbox/leads") {
  const route = suiteDataRouter.stack.find(
    layer => layer.route?.path === path && (layer.route as RuntimeRoute).methods[method],
  )!.route;

  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    let status = 200;
    let index = 0;
    const req = {
      query,
      params: {},
      body,
      user: { id: "operator", companyCode: "SPA01" },
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(data: unknown) {
        resolve({ status, body: data });
        return this;
      },
    } as unknown as Response;
    const next: NextFunction = (error?: unknown) => {
      if (error) return reject(error);
      const layer = route.stack[index++];
      if (!layer) return reject(new Error("No response"));
      try {
        layer.handle(req, res, next);
      } catch (err) {
        reject(err);
      }
    };
    next();
  });
}

const queryLeads = (query: Record<string, string>) => requestLeads("get", query);

it("reads only the linked Lead summary for the current company, account and conversation", async () => {
  state.permissions = ["omni-inbox:read"];
  const companyAccount = vi.spyOn(SocialIntegrationModel, "exists").mockResolvedValue(null);
  const personalAccount = vi.spyOn(UserModel, "exists").mockResolvedValue(null);
  const select = vi.fn(() => ({ lean: async () => ({ collectionStatus: "complete" }) }));
  state.findOne.mockReturnValueOnce({ select });
  try {
    const result = await requestLeads("get", { channel: "zalo", accountId: "OA", conversationId: "CONV" }, {}, "/omni-inbox/leads/by-conversation");
    expect(result).toEqual({ status: 200, body: { status: "success", data: { collectionStatus: "complete" } } });
    expect(state.findOne).toHaveBeenCalledWith({ companyCode: "SPA01", sourcePlatform: "zalo", sourceAccountId: "OA", sourceConversationId: "CONV" });
    expect(select).toHaveBeenCalledWith("collectionStatus moduleSync.targetModule customerTransfer.completedAt customerTransfer.destination");
  } finally {
    companyAccount.mockRestore();
    personalAccount.mockRestore();
    state.findOne.mockReset();
  }
});

it("creates a manual Lead in an owned account worksheet without a conversation", async () => {
  const owned = vi.spyOn(SocialIntegrationModel, "exists").mockResolvedValue({ _id: "oa" } as never);
  const personal = vi.spyOn(UserModel, "exists").mockResolvedValue(null);
  state.create.mockImplementation(async data => ({ toObject: () => data }));
  try {
    const response = await requestLeads("post", {}, {
      customerName: "An", sourcePlatform: "zalo", sourceAccountId: "OA",
      answers: { sdt: "0901234567" },
      intakeFields: [{ key: "sdt", label: "SĐT", question: "SĐT", type: "phone" }],
    });
    expect(response.status).toBe(201);
    expect(owned).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "SPA01", platform: "Zalo", username: "OA" }));
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "SPA01", sourcePlatform: "zalo", sourceAccountId: "OA",
      phone: "0901234567", answers: { sdt: "0901234567" },
    }));
    expect(state.create.mock.calls[0][0]).not.toHaveProperty("sourceConversationId");
    state.create.mockRejectedValueOnce({ code: 11000 });
    expect(await requestLeads("post", {}, {
      customerName: "Tên sửa", sourcePlatform: "zalo", sourceAccountId: "OA", sourceConversationId: "CONV",
    })).toMatchObject({ status: 409, body: { message: expect.stringContaining("Hội thoại đã có Lead") } });
    owned.mockResolvedValue(null);
    expect((await requestLeads("post", {}, {
      customerName: "An", sourcePlatform: "zalo", sourceAccountId: "OTHER-OA",
    })).status).toBe(404);
    expect(state.create).toHaveBeenCalledTimes(2);
  } finally {
    owned.mockRestore();
    personal.mockRestore();
    state.create.mockReset();
  }
});

describe("GET /omni-inbox/leads dynamic field filtering & sorting", () => {
  beforeEach(() => {
    state.findFilter = {};
    state.sortExpr = "";
    state.permissions = ["omni-inbox:read"];
    state.rows = [];
  });

  it("supports frontend field:asc/desc sorting for both system and custom answers.* columns", async () => {
    expect((await queryLeads({ sort: "customerName:asc" })).status).toBe(200);
    expect(state.sortExpr).toBe("customerName -_id");

    expect((await queryLeads({ sort: "answers.ngan_sach:desc" })).status).toBe(200);
    expect(state.sortExpr).toBe("-answers.ngan_sach -_id");

    expect((await queryLeads({ sort: "-updatedAt" })).status).toBe(200);
    expect(state.sortExpr).toBe("-updatedAt -_id");
  });

  it("falls back to default sort when given disallowed or unsafe sort keys", async () => {
    expect((await queryLeads({ sort: "answers.$where:asc" })).status).toBe(200);
    expect(state.sortExpr).toBe("-lastInteractionAt -_id");

    expect((await queryLeads({ sort: "__proto__:desc" })).status).toBe(200);
    expect(state.sortExpr).toBe("-lastInteractionAt -_id");

    expect((await queryLeads({ sort: "secretToken:asc" })).status).toBe(200);
    expect(state.sortExpr).toBe("-lastInteractionAt -_id");
  });

  it("builds safe company-scoped Mongo filters from fieldFilters and search", async () => {
    const fieldFilters = JSON.stringify([
      { key: "answers.nhu_cau", value: "Trị mụn (VIP)", mode: "contains" },
      { key: "answers.goi_dv", value: "Premium", mode: "exact" },
      { key: "value", value: "5.000.000", mode: "exact" },
      { key: "updatedAt", value: "2026-11-11", mode: "exact" },
      { key: "answers.$ne", value: "hack", mode: "contains" },
      { key: "passwordHash", value: "hack", mode: "contains" },
    ]);

    const res = await queryLeads({
      search: "Minh Anh",
      fieldFilters,
      sort: "answers.nhu_cau:asc",
    });

    expect(res.status).toBe(200);
    expect(state.sortExpr).toBe("answers.nhu_cau -_id");
    expect(state.findFilter.companyCode).toBe("SPA01");

    const andClauses = state.findFilter.$and as Array<Record<string, unknown>>;
    expect(Array.isArray(andClauses)).toBe(true);
    expect(andClauses).toHaveLength(5);

    expect(andClauses[0]).toHaveProperty("$or");
    expect(andClauses[1]).toEqual({
      "answers.nhu_cau": { $regex: "Trị mụn \\(VIP\\)", $options: "i" },
    });
    expect(andClauses[2]).toEqual({
      "answers.goi_dv": { $regex: "^Premium$", $options: "i" },
    });
    expect(andClauses[3]).toEqual({ value: 5000000 });
    expect(andClauses[4]).toHaveProperty("updatedAt.$gte");
    expect(andClauses[4]).toHaveProperty("updatedAt.$lte");
  });

  it("handles unchecked checkbox filters, grouped currency text, and validated altKeys", async () => {
    const fieldFilters = JSON.stringify([
      { key: "answers.dat_lich", value: "Không", mode: "unchecked" },
      { key: "answers.ngan_sach", value: "5.000.000", mode: "contains" },
      { key: "answers.tuoi", altKeys: ["answers.do_tuoi", "secretToken", "answers.$where"], value: "25", mode: "contains" },
    ]);

    const res = await queryLeads({ fieldFilters });
    expect(res.status).toBe(200);

    const andClauses = state.findFilter.$and as Array<Record<string, unknown>>;
    expect(andClauses).toHaveLength(3);
    expect(andClauses[0]).toEqual({
      $or: [
        { "answers.dat_lich": { $exists: false } },
        { "answers.dat_lich": { $in: ["", "Không", "không", "false", "0"] } },
      ],
    });
    expect(andClauses[1]).toEqual({
      "answers.ngan_sach": { $regex: "(5\\.000\\.000|5000000)", $options: "i" },
    });
    expect(andClauses[2]).toEqual({
      $or: [
        { "answers.tuoi": { $regex: "25", $options: "i" } },
        { "answers.do_tuoi": { $regex: "25", $options: "i" } },
      ],
    });
  });
});

