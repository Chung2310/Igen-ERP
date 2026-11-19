import { describe, expect, it } from "vitest";
import { getVbplSyncConfig, normalizeVbplSourceDocument, parseVbplScopes, unwrapVbplData } from "./vbpl-sync.service";

describe("VBPL sync adapter", () => {
  it("validates selected jurisdiction scopes and source IDs", () => {
    expect(parseVbplScopes(JSON.stringify([
      { jurisdiction: "central", donViIds: [13, "13", -1, "bad"], documentTypeIds: [21], documentKinds: [1, 3] },
      { jurisdiction: "unknown", donViIds: [13] },
    ]))).toEqual([{ jurisdiction: "central", donViIds: [13], documentTypeIds: [21], documentKinds: [1, 3], province: "" }]);
    expect(parseVbplScopes(undefined)).toEqual([]);
  });

  it("maps official document fields to the repository without inventing amendment targets", () => {
    const source = normalizeVbplSourceDocument({
      ID: 147679,
      VBPQSokyhieu: "27/2020/NQ-HĐND",
      VBPQTrichYeu: "Về chính sách hỗ trợ",
      VBPQCoquanbanhanh: "61;#Hội đồng nhân dân tỉnh",
      VBPQNgayBanHanh: "2020-06-01T00:00:00Z",
      VBPQNgaycohieuluc: "2020-07-01T00:00:00Z",
      VBPQTinhTrangHieuLuc: { LookupValue: "Còn hiệu lực" },
      VBPQVanbanduocsuadoi: "VBPQ ID 1234",
      VBPQToanVan: "<p>Điều 1. Nội dung</p>",
    }, { jurisdiction: "local", donViIds: [61], documentTypeIds: [], documentKinds: [1], province: "Tỉnh A" }, 1);

    expect(source).toMatchObject({
      id: "147679",
      symbol: "27/2020/NQ-HĐND",
      title: "Về chính sách hỗ trợ",
      issuingAuthority: "Hội đồng nhân dân tỉnh",
      jurisdiction: "local",
      province: "Tỉnh A",
      status: "effective",
      sourceDocumentId: "147679",
      requiresRelationReview: true,
    });
    expect(source?.sourceUrl).toContain("ItemID=147679");
    expect(source?.relatedDocuments).toEqual([]);
  });

  it("accepts the portal's JSON-string data envelope and requires a key plus at least one scope", () => {
    expect(unwrapVbplData({ statusCode: 200, success: false, message: "Thanh Cong", data: "{\"LtsVanBan\":[{\"ID\":7}],\"TotalRecord\":1}" })).toEqual({ LtsVanBan: [{ ID: 7 }], TotalRecord: 1 });
    expect(() => getVbplSyncConfig({} as NodeJS.ProcessEnv)).toThrow("VBPL_USER_KEY");
    expect(() => getVbplSyncConfig({ VBPL_USER_KEY: "key" } as NodeJS.ProcessEnv)).toThrow("VBPL_SYNC_SCOPES_JSON");
    const config = getVbplSyncConfig({ VBPL_USER_KEY: "test-key", VBPL_SYNC_SCOPES_JSON: "[{\"jurisdiction\":\"central\",\"donViIds\":[13]}]" } as NodeJS.ProcessEnv);
    expect(config.searchUrl).toBe("https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/tim-kiem-van-ban");
    expect(config.scopes).toHaveLength(1);
    expect(config).not.toHaveProperty("apiKey");
  });
});
