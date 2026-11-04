import { beforeEach, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
const mocks = vi.hoisted(() => ({ user: vi.fn(), module: vi.fn(), permissions: vi.fn(), owns: vi.fn(), connected: vi.fn() }));
vi.mock("../../../model/user.model", () => ({ UserModel: { findById: () => ({ lean: mocks.user }) } }));
vi.mock("../../../middleware/require-module", () => ({ getModuleStateForCompany: async () => ({}), resolveModuleAccess: mocks.module }));
vi.mock("../../../middleware/auth", () => ({ getEffectivePermissions: mocks.permissions }));
vi.mock("../shared/model/social-integration.model", () => ({ SocialIntegrationModel: { exists: mocks.connected } }));
vi.mock("../shared/account-ownership", () => ({ assertMarketingAccountOwnership: mocks.owns }));
vi.mock("../shared/socket", () => ({ messengerRoom: (company: string, channel: string, account: string) => `marketing:messenger:${company}:${channel}:${account}` }));
import { attachMessengerScopes } from "./socket-scopes";
const scope = { channel: "facebook", accountId: "page" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ _id: "user", role: "admin", companyCode: "ABC" });
  mocks.module.mockReturnValue(true);
  mocks.permissions.mockResolvedValue(new Set());
  mocks.connected.mockResolvedValue(true);
});
function setup() {
  let handle!: (scopes: unknown, ack: ReturnType<typeof vi.fn>) => Promise<void>;
  const rooms = new Set(["company:ABC", "marketing:messenger:ABC:facebook:old"]);
  const socket = { id: "socket", data: { user: { _id: "user" } }, rooms,
    on: (_event: string, callback: typeof handle) => { handle = callback; },
    join: vi.fn(async (values: string[]) => { values.forEach(value => rooms.add(value)); }),
    leave: vi.fn(async (room: string) => { rooms.delete(room); }) };
  attachMessengerScopes(socket as unknown as Socket);
  return { socket, handle, ack: vi.fn() };
}
it("acknowledges only after joining the authorized account room", async () => {
  const { socket, handle, ack } = setup();
  await handle([scope], ack);
  expect(socket.rooms.has("marketing:messenger:ABC:facebook:page")).toBe(true);
  expect(socket.rooms.has("marketing:messenger:ABC:facebook:old")).toBe(false);
  expect(ack).toHaveBeenCalledWith({ success: true, scopes: [scope] });
});
it("reports denied subscriptions instead of silently leaving a connected client without a room", async () => {
  mocks.module.mockReturnValue(false);
  const { socket, handle, ack } = setup();
  await handle([scope], ack);
  expect(ack).toHaveBeenCalledWith({ success: false, scopes: [], code: "MODULE_DISABLED" });
  expect([...socket.rooms]).toEqual(["company:ABC"]);
});
it("keeps current rooms during authorization and rejects stale requests after page switches", async () => {
  let release!: () => void;
  mocks.owns.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const { socket, handle, ack } = setup();
  const pending = handle([scope], ack);
  await vi.waitFor(() => expect(mocks.owns).toHaveBeenCalledOnce());
  expect(socket.rooms.has("marketing:messenger:ABC:facebook:old")).toBe(true);
  await handle([{ ...scope, accountId: "new" }], ack);
  release();
  await pending;
  expect([...socket.rooms]).toEqual(["company:ABC", "marketing:messenger:ABC:facebook:new"]);
  expect(ack).toHaveBeenCalledTimes(1);
});
