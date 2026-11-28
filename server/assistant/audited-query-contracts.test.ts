import { afterEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
vi.mock("./workflows", () => ({ actorScope: () => ({ userId: "actor", companyCode: "TEST" }), assertOperation: async () => undefined }));
import { operationById, defaultWorkflow } from "./catalog";
import { callOperation } from "./executor";
import { interpretRequest } from "./semantic-interpreter";
import { collectValues, validateField } from "./policy";
afterEach(() => { vi.unstubAllGlobals(); provider.mockReset(); });
const req: any = { user: { id: "actor", companyCode: "TEST", role: "admin", branchId: "222222222222222222222222" }, headers: {}, socket: { localAddress: "127.0.0.1", localPort: 3000 } };
it('keeps authenticated scope in headers without injecting rejected query fields into progression',async()=>{
 const op=operationById('student.learning-roadmap.progression.list')!,fetcher=vi.fn(async()=>new Response(JSON.stringify({success:true,data:{rows:[]}})));
 vi.stubGlobal('fetch',fetcher);
 await callOperation(req,op,{path_batchId:'333333333333333333333333'});
 const [raw,init]=fetcher.mock.calls[0] as unknown as [URL,RequestInit],url=new URL(String(raw));
 expect(url.searchParams.has('branchId')).toBe(false);expect(url.searchParams.has('companyCode')).toBe(false);
 expect(new Headers(init.headers).get('x-branch-id')).toBe(req.user.branchId);
});
const cases: Array<{ id: string; input: Record<string, string | number> }> = [
  {
    "id": "api.get.3938bd395acae1c5",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30",
      "groupBy": "technician"
    }
  },
  {
    "id": "api.get.25ab7ad5caa4684f",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.68886fa48772aa78",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.e25284fbbeeaf62d",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.7517d0cca9ca76c9",
    "input": {
      "phone": "0900000000"
    }
  },
  {
    "id": "api.get.2c71c36e4f1d283e",
    "input": {
      "technicianId": "333333333333333333333333",
      "limit": 10
    }
  },
  {
    "id": "api.get.51885b828100e376",
    "input": {
      "q": "AUDIT_CUSTOMER",
      "limit": 5
    }
  },
  {
    "id": "inventory.supplier.list",
    "input": {
      "q": "AUDIT_SUPPLIER",
      "status": "active"
    }
  },
  {
    "id": "api.get.790586d43d8979d7",
    "input": {
      "limit": 80
    }
  },
  {
    "id": "api.get.34a8d9d0814701f9",
    "input": {
      "status": "failed",
      "limit": 100,
      "automationType": "birthday"
    }
  },
  {
    "id": "api.get.070d48d67bb5ed90",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.203a9f8e9a785680",
    "input": {
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.7c1d9c9cda4722a9",
    "input": {
      "path_id": "333333333333333333333333",
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  },
  {
    "id": "api.get.5ac7dee040f9bb15",
    "input": {
      "days": 7,
      "scope": "supplier"
    }
  }
];

it.each(cases)("preserves model filters through interpretation and HTTP for $id", async ({ id, input }) => {
  const op = operationById(id)!;
  const text = "Tra cứu theo đúng khoảng ngày và các điều kiện đã nêu";
  provider.mockResolvedValue({ text: JSON.stringify({ actionId: id, values: input, intentType: "workflow",
    requestCoverage: [{ evidence: text, requirement: "Giữ các điều kiện fixture", mappedTo: ["action", ...Object.keys(input).map(key => `values.${key}`)] }],
  }) });
  const result = await interpretRequest(text, [defaultWorkflow(op)], null, []);
  expect(result.actionId, JSON.stringify(result)).toBe(id);
  expect(result.values).toMatchObject(input);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await callOperation(req, op, result.values as any);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = new URL(String((fetcher.mock.calls[0] as unknown as [URL])[0]));
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("path_")) expect(url.pathname).toContain(String(value));
    else expect(url.searchParams.get(key), key).toBe(String(value));
  }
});
it.each(cases.filter(c => 'from' in c.input))("requires missing report dates for $id", ({id}) => {
  const workflow = defaultWorkflow(operationById(id)!);
  for (const key of ['from', 'to']) expect(workflow.fields.find(f => f.key === key)).toMatchObject({ required: true, systemRequired: true });
  const collected = collectValues(workflow, { from: '2026-11-01' });
  expect(collected.missing).toContain('Đến ngày');
  expect(collected.values).not.toHaveProperty('to');
});
it("validates actual API domains and limits", () => {
  const field = (id: string, key: string) => operationById(id)!.fields.find(f => f.key === key)!;
  expect(() => validateField(field('api.get.5ac7dee040f9bb15', 'scope'), 'company')).toThrow();
  expect(() => validateField(field('api.get.51885b828100e376', 'limit'), 21)).toThrow();
  expect(() => validateField(field('api.get.34a8d9d0814701f9', 'status'), 'unknown')).toThrow();
  expect(() => validateField(field('api.get.790586d43d8979d7', 'limit'), 0)).toThrow();
});
