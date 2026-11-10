import { describe, expect, it } from "vitest";
import { matchCakeBranchLocation } from "./cake-branch-location";

const mainBranch = { code: "MAIN", name: "Tiệm bánh Vibary", address: "Số 3 Nguyễn Văn Trỗi, Phường Kinh Bắc, Thành phố Bắc Ninh" };
const hcmBranch = { code: "Q3", name: "Chi nhánh Quận 3", address: "Quận 3, TP. Hồ Chí Minh" };

describe("matchCakeBranchLocation", () => {
  it("matches a branch from a shortened Vietnamese address", () => {
    expect(matchCakeBranchLocation([mainBranch, hcmBranch], "Tiệm Vibary số 3 Nguyễn Văn Trỗi, Kinh Bắc, Bắc Ninh"))
      .toEqual(mainBranch);
  });

  it("leaves the branch unresolved when multiple branches share the supplied location", () => {
    const nearbyBranch = { ...mainBranch, code: "MAIN-2", name: "Điểm nhận Vibary", address: "Số 5 Nguyễn Văn Trỗi, Phường Kinh Bắc, Thành phố Bắc Ninh" };
    expect(matchCakeBranchLocation([mainBranch, nearbyBranch], "Nguyễn Văn Trỗi, Kinh Bắc, Bắc Ninh")).toBeUndefined();
  });

  it("does not infer a branch from an empty location", () => {
    expect(matchCakeBranchLocation([mainBranch], "")).toBeUndefined();
  });
});
