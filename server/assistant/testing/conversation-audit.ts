import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Opt-in evidence from mocked conversation tests, never production telemetry. */
export function conversationAudit(module: string, limits = "AI provider and business HTTP are mocked. No real database writes. Permissions and response rewriting are mocked in these fixtures.") {
  let turns: unknown[] = [];
  let requests: unknown[] = [];
  return {
    reset() { turns = []; requests = []; },
    async turn(input: unknown, run: () => Promise<any>) {
      if (!process.env.ASSISTANT_CONVERSATION_AUDIT_OUTPUT) return run();
      const mockedFetch = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        const parsed = new URL(String(url));
        if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new Error("Audit forbids external HTTP");
        const response = await mockedFetch(url, init);
        let payload: unknown;
        try { payload = await response.clone().json(); } catch { payload = "Non-JSON mock response"; }
        requests.push({ path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), method: init?.method || "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, status: response.status, response: payload });
        return response;
      };
      try {
        const reply = await run();
        turns.push({ input: structuredClone(input), reply: structuredClone(reply) });
        return reply;
      } catch (error) {
        turns.push({ input, error: String(error) });
        throw error;
      } finally { globalThis.fetch = mockedFetch; }
    },
    async write(context: any, mocks: { provider: any; interpret: any }, records: unknown) {
      if (!process.env.ASSISTANT_CONVERSATION_AUDIT_OUTPUT) return;
      const outputs = async (mock: any) => Promise.all(mock.mock.results.map(async (result: any) => {
        try { return { type: result.type, value: await result.value }; } catch (error) { return { type: "rejected", error: String(error) }; }
      }));
      mkdirSync(dirname(process.env.ASSISTANT_CONVERSATION_AUDIT_OUTPUT), { recursive: true });
      appendFileSync(process.env.ASSISTANT_CONVERSATION_AUDIT_OUTPUT, JSON.stringify({ module, name: context.task.name, status: context.task.result?.state, simulation: true,
        turns, apiCalls: requests, records, aiProviderOutputs: await outputs(mocks.provider), interpreterOutputs: await outputs(mocks.interpret),
        limits }) + "\n", "utf8");
    },
  };
}
