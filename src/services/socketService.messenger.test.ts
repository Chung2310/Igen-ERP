// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { socket, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const socket = { connected: false, on: vi.fn((event: string, callback: (...args: any[]) => void) => { handlers.set(event, callback); }),
    off: vi.fn(), emit: vi.fn(), timeout: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  return { socket, handlers };
});
vi.mock("socket.io-client", () => ({ io: () => socket }));
const scope = { channel: "facebook" as const, accountId: "page" };
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  handlers.clear();
  socket.connected = false;
  socket.timeout.mockReturnValue(socket);
});
afterEach(() => vi.useRealTimers());

async function connected() {
  const { socketService } = await import("./socketService");
  socketService.setMessengerScopes([scope]);
  socketService.connect("token");
  socket.connected = true;
  handlers.get("connect")!();
  return socketService;
}
it("does not subscribe to Messenger when no inbox scopes were selected", async () => {
  const { socketService } = await import("./socketService");
  socketService.setMessengerScopes([]);
  socketService.connect("token"); socket.connected = true;
  handlers.get("connect")!();
  expect(socket.emit).not.toHaveBeenCalled();
});
it("clears the previous inbox rooms when leaving the last selected account", async () => {
  const service = await connected();
  service.setMessengerScopes([]);
  expect(socket.emit.mock.calls.at(-1)!.slice(0, 2)).toEqual(["set_messenger_scopes", []]);
});

it("does not mistake transport connectivity for an authorized Messenger subscription", async () => {
  const service = await connected();
  expect(service.isConnected()).toBe(true);
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(false);
  const acknowledge = socket.emit.mock.calls.at(-1)![2];
  acknowledge(null, { success: true, scopes: [scope] });
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(true);
});

it("ignores late room acknowledgements after switching pages", async () => {
  const service = await connected();
  const oldAck = socket.emit.mock.calls.at(-1)![2];
  service.setMessengerScopes([{ ...scope, accountId: "new-page" }]);
  oldAck(null, { success: true, scopes: [scope] });
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(false);
  socket.emit.mock.calls.at(-1)![2](null, { success: true, scopes: [{ ...scope, accountId: "new-page" }] });
  expect(service.isMessengerScopeReady("facebook", "new-page")).toBe(true);
});

it("invalidates subscription on disconnect and confirms rooms again on reconnect", async () => {
  const service = await connected();
  socket.emit.mock.calls.at(-1)![2](null, { success: true, scopes: [scope] });
  socket.connected = false;
  handlers.get("disconnect")!("transport close");
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(false);
  socket.connected = true;
  handlers.get("connect")!();
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(false);
  socket.emit.mock.calls.at(-1)![2](null, { success: true, scopes: [scope] });
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(true);
});

it("bounds subscription retries instead of repeatedly calling history or Graph APIs", async () => {
  const service = await connected();
  for (let index = 0; index < 3; index++) {
    socket.emit.mock.calls.at(-1)![2](null, { success: false, scopes: [], code: "MODULE_DISABLED" });
    await vi.advanceTimersByTimeAsync(10000);
  }
  expect(socket.emit).toHaveBeenCalledTimes(3);
  expect(service.isMessengerScopeReady("facebook", "page")).toBe(false);
});
