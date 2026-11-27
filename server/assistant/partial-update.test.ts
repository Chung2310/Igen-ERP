import { expect, it } from "vitest";
import { hydratePartialUpdate, mergePartialRecord } from "./partial-update";
import { ASSISTANT_OPERATIONS } from "./catalog";
it("merges nested edits without changing sibling configuration across modules", () => {
  const current = { terms: { amount: 100, unit: "VND" }, contacts: ["An", "Bình"], name: "A" };
  expect(mergePartialRecord(current, { terms: { amount: 200 }, contacts: ["Lan"] })).toEqual({ terms: { amount: 200, unit: "VND" }, contacts: ["Lan"], name: "A" });
  expect(current.terms.amount).toBe(100);
  expect(() => mergePartialRecord({}, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
});
it("preserves rates when reducing months and never invents rates when increasing", () => {
  const op = ASSISTANT_OPERATIONS.find(o => o.partialUpdate && o.module === "labor-partner")!;
  const current = { name: "Cuối năm", official: { enabled: true, maxMonths: 3, milestones: [1, 2, 3].map(month => ({ month, amount: month * 100000, eligibilityRule: "contract_active" })) } };
  const reduced = hydratePartialUpdate(op, current, { official: '{"maxMonths":2}' });
  expect(JSON.parse(String(reduced.values.official))).toEqual({ enabled: true, maxMonths: 2, milestones: current.official.milestones.slice(0, 2) });
  expect(reduced.inherited).toContain("name");
  const increased = hydratePartialUpdate(op, { ...current, official: { ...current.official, maxMonths: 1, milestones: current.official.milestones.slice(0, 1) } }, { official: '{"maxMonths":3}' });
  expect(JSON.parse(String(increased.values.official)).milestones).toHaveLength(1);
  const amountOnly = hydratePartialUpdate(op, current, { official: '{"milestones":[{"month":2,"amount":500000}]}' });
  expect(JSON.parse(String(amountOnly.values.official)).milestones).toEqual(current.official.milestones.map(row => row.month === 2 ? { ...row, amount: 500000 } : row));
  const supplied=hydratePartialUpdate({...op,path:'/another-module/config/:id'},current,{official:JSON.stringify({maxMonths:2,milestones:[{month:1,amount:500000},{month:2,amount:500000}]})});
  expect(JSON.parse(String(supplied.values.official)).milestones).toEqual([1,2].map(month=>({month,amount:500000,eligibilityRule:'contract_active'})));
  const invalid=hydratePartialUpdate(op,current,{official:JSON.stringify({maxMonths:2,milestones:[{month:3,amount:500000}]})});
  expect(JSON.parse(String(invalid.values.official)).milestones.find((r:any)=>r.month===3)?.amount).toBe(500000);
});
