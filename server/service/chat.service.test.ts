import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatService } from "./chat.service";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { UserModel } from "../model/user.model";
vi.mock("./chat-resource-indexing.service", () => ({ chatResourceIndexingService: {} }));
vi.mock("../model/chat-room.model", () => ({ ChatRoomModel: Object.assign(vi.fn(), { findOne: vi.fn(), find: vi.fn() }) }));
vi.mock("../model/chat-message.model", () => ({ ChatMessageModel: { countDocuments: vi.fn(async () => 2) } }));
vi.mock("../model/user.model", () => ({ UserModel: { findById: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());
describe("internal room listing", () => {
  it("excludes legacy AI rooms and does not create an assistant", async () => {
    vi.mocked(UserModel.findById).mockReturnValue({ select: () => ({ lean: async () => ({}) }) } as any);
    vi.mocked(ChatRoomModel.findOne).mockReturnValue({ exec: async () => ({ _id: "cloud" }) } as any);
    const rooms = [{ _id: "team", members: [], updatedAt: "2026-01-01" }];
    const query = { populate: vi.fn(), sort: vi.fn(), lean: vi.fn(), exec: vi.fn(async () => rooms) };
    query.populate.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    vi.mocked(ChatRoomModel.find).mockReturnValue(query as any);
    expect(await chatService.getRooms("me", "ACME")).toEqual([{ ...rooms[0], unreadCount: 2 }]);
    expect(ChatRoomModel.find).toHaveBeenCalledWith({ companyCode: "ACME", "members.userId": "me", isChatbot: { $ne: true } });
    expect(ChatRoomModel).not.toHaveBeenCalled();
    expect(ChatRoomModel.findOne).toHaveBeenCalledTimes(1);
    expect(ChatMessageModel.countDocuments).toHaveBeenCalledTimes(1);
  });
});
