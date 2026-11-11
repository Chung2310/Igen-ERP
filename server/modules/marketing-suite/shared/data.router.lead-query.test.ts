import type { IRoute, NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { suiteDataRouter } from "./data.router";

const state = vi.hoisted(() => ({
  findFilter: {} as Record<string, unknown>,
  sortExpr: "",
  permissions: ["omni-inbox:read"],
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../middleware/auth", () => ({
  requirePermission: (permission: string) => (_req: Request, res: Response, next: NextFunction) =>
    state.permissions.includes(permission) ? next() : res.status(403).json({ status: "error" }),
}));

vi.mock("../message/model/crm-ticket.model", () => ({
  CRMTicketModel: {
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

function queryLeads(query: Record<string, string>) {
  const route = suiteDataRouter.stack.find(
    layer => layer.route?.path === "/omni-inbox/leads" && (layer.route as RuntimeRoute).methods.get,
  )!.route;

  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    let status = 200;
    let index = 0;
    const req = {
      query,
      params: {},
      body: {},
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
});

