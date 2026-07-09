import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { UserModel } from "./model/user.model";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { ChatRoomModel } from "./model/chat-room.model";

let io: SocketIOServer | null = null;

/**
 * Gắn Redis adapter cho Socket.IO để phát sự kiện xuyên nhiều instance (scale ngang).
 * Tự phục hồi: nếu Redis lỗi/chưa sẵn sàng, log cảnh báo và vẫn chạy (delivery nội bộ 1 instance).
 * Cần sticky session (nginx ip_hash) khi chạy sau load balancer nhiều node.
 */
async function attachRedisAdapter(server: SocketIOServer) {
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  console.log(`[Socket.IO] Đang kiểm tra kết nối Redis tại ${host}:${port}...`);

  const tempClient = new Redis({
    host,
    port,
    password,
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 0,
  });

  try {
    await tempClient.connect();
    await tempClient.quit();

    const redisOptions = {
      host,
      port,
      password,
      enableReadyCheck: false,
      maxRetriesPerRequest: null as unknown as number,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    };

    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    pubClient.on("error", (e: any) => console.error("[Socket.IO Redis pub] error:", e?.message || e));
    subClient.on("error", (e: any) => console.error("[Socket.IO Redis sub] error:", e?.message || e));
    pubClient.once("ready", () =>
      console.log(`[Socket.IO] Redis adapter đã kết nối ${host}:${port} — scale ngang đã bật.`)
    );

    server.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Đã gắn Redis adapter (pub/sub).");
  } catch (err: any) {
    tempClient.disconnect();
    console.warn(
      `[Socket.IO] Không kết nối được Redis tại ${host}:${port} (${err?.message || err}) → Chạy chế độ in-memory (chỉ 1 instance).`
    );
  }
}

function getAllowedOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:5173", "http://localhost:3000"]);
  
  if (process.env.LINK_COR) {
    process.env.LINK_COR.split(",").forEach(o => origins.add(o.trim()));
  }
  
  if (process.env.APP_URL) {
    origins.add(process.env.APP_URL.trim());
    try {
      const url = new URL(process.env.APP_URL);
      origins.add(url.origin);
    } catch (e) {
      // Bỏ qua nếu APP_URL không hợp lệ
    }
  }

  return Array.from(origins);
}

export async function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Gắn Redis adapter để scale ngang nhiều instance
  await attachRedisAdapter(io);

  // Reset tất cả users về offline khi server khởi động (tránh trạng thái lỗi từ session trước)
  void (async () => {
    try {
      await UserModel.updateMany({ status: "online" }, { $set: { status: "offline" } });
      console.log("[Socket.IO] Đã reset tất cả trạng thái users về offline khi server khởi động.");
    } catch (err) {
      console.error("[Socket.IO] Lỗi khi reset trạng thái users:", err);
    }
  })();

  // JWT Middleware for socket connection authentication
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "your_jwt_access_secret_key"
      ) as any;

      const user = await UserModel.findById(decoded.id).lean();
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;

    console.log(`[Socket.IO] Client connected: ${user?.email || "Unknown"} (Socket: ${socket.id})`);

    // Join room riêng theo userId để gửi sự kiện cá nhân (không broadcast toàn server)
    if (user?._id) {
      const userId = user._id.toString();
      const companyCode = user.companyCode;
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`[Socket.IO] User ${user?.email} joined personal room: ${userRoom}`);

      // Xử lý cập nhật presence online bất đồng bộ
      void (async () => {
        try {
          await UserModel.findByIdAndUpdate(userId, { status: "online" });
          if (companyCode) {
            const companyRoom = `company:${companyCode}`;
            socket.join(companyRoom);
            socket.to(companyRoom).emit("user_presence_change", {
              userId,
              status: "online",
            });
          }
        } catch (err) {
          console.error("[Socket.IO] Lỗi cập nhật trạng thái online:", err);
        }
      })();
    }

    void (async () => {
      const roomIds = new Set<string>();

      const personalPageId = user?.facebookIntegration?.isConnected && user.facebookIntegration.pageId
        ? user.facebookIntegration.pageId
        : "";
      const personalOaId = user?.zaloIntegration?.isConnected && user.zaloIntegration.oaId
        ? user.zaloIntegration.oaId
        : "";
      const personalTiktokId = user?.tiktokIntegration?.isConnected && user.tiktokIntegration.username
        ? user.tiktokIntegration.username
        : "";

      if (personalPageId) roomIds.add(personalPageId);
      if (personalOaId) roomIds.add(personalOaId);
      if (personalTiktokId) roomIds.add(personalTiktokId);

      if (user?.companyCode) {
        try {
          const companyIntegrations = await SocialIntegrationModel.find({
            companyCode: user.companyCode,
            isConnected: true,
            platform: { $in: ["Facebook", "Zalo", "TikTok"] },
          }).select("platform username");

          companyIntegrations.forEach((integration: any) => {
            if (integration?.username) {
              roomIds.add(integration.username);
            }
          });
        } catch (error) {
          console.error("[Socket.IO] Khong the nap company integrations de join room:", error);
        }
      }

      if (process.env.FB_PAGE_ID) {
        roomIds.add(process.env.FB_PAGE_ID);
      }

      if (process.env.ZALO_OA_ID) {
        roomIds.add(process.env.ZALO_OA_ID);
      }

      roomIds.forEach((id) => {
        const room = `page:${id}`;
        socket.join(room);
        console.log(`[Socket.IO] User ${user?.email} joined room: ${room}`);
      });

      // Tự động join các phòng chat nội bộ của user
      if (user?._id && user?.companyCode) {
        try {
          const chatRooms = await ChatRoomModel.find({
            companyCode: user.companyCode,
            "members.userId": user._id,
          }).select("_id");

          chatRooms.forEach((cr) => {
            const chatRoomName = `chat_room:${cr._id.toString()}`;
            socket.join(chatRoomName);
            console.log(`[Socket.IO] User ${user.email} joined internal chat room: ${chatRoomName}`);
          });
        } catch (error) {
          console.error("[Socket.IO] Khong the nap danh sach phong chat de join room:", error);
        }
      }
    })();

    // Lắng nghe sự kiện tham gia phòng chat thủ công
    socket.on("join_chat_room", (data: { roomId: string }) => {
      if (!data?.roomId || !user?._id) return;
      ChatRoomModel.findOne({ _id: data.roomId, "members.userId": user._id })
        .then((room) => {
          if (room) {
            const chatRoomName = `chat_room:${data.roomId}`;
            socket.join(chatRoomName);
            console.log(`[Socket.IO] User ${user.email} joined chat room manually: ${chatRoomName}`);
          }
        })
        .catch((err) => console.error("Error joining chat room manually:", err));
    });

    // Lắng nghe sự kiện rời phòng chat thủ công
    socket.on("leave_chat_room", (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const chatRoomName = `chat_room:${data.roomId}`;
      socket.leave(chatRoomName);
      console.log(`[Socket.IO] User ${user?.email} left chat room manually: ${chatRoomName}`);
    });

    // Lắng nghe sự kiện đang nhập tin nhắn
    socket.on("typing_status", (data: { roomId: string; isTyping: boolean }) => {
      if (!data?.roomId || !user?._id) return;
      const chatRoomName = `chat_room:${data.roomId}`;
      socket.to(chatRoomName).emit("internal_typing_status", {
        roomId: data.roomId,
        userId: user._id.toString(),
        displayName: user.displayName,
        isTyping: data.isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      if (user?._id) {
        const userId = user._id.toString();
        const companyCode = user.companyCode;

        void (async () => {
          try {
            const userRoom = `user:${userId}`;
            const activeSockets = await io?.in(userRoom).fetchSockets();

            // Nếu không còn socket nào kết nối cho userId này
            if (!activeSockets || activeSockets.length === 0) {
              await UserModel.findByIdAndUpdate(userId, { status: "offline" });
              if (companyCode) {
                const companyRoom = `company:${companyCode}`;
                io?.to(companyRoom).emit("user_presence_change", {
                  userId,
                  status: "offline",
                });
              }
            }
          } catch (err) {
            console.error("[Socket.IO] Lỗi cập nhật trạng thái offline khi disconnect:", err);
          }
        })();
      }
    });
  });

  return io;
}

export function emitToPage(pageId: string, eventName: string, data: any) {
  if (io) {
    const room = `page:${pageId}`;
    console.log(`[Socket.IO] Emitting event "${eventName}" to room: ${room}`);
    io.to(room).emit(eventName, data);
  } else {
    console.warn("[Socket.IO] Server instance (io) not initialized.");
  }
}

export function emitToUser(userId: string, eventName: string, data: any) {
  if (io) {
    const room = `user:${userId}`;
    console.log(`[Socket.IO] Emitting event "${eventName}" to room: ${room}`);
    io.to(room).emit(eventName, data);
  } else {
    console.warn("[Socket.IO] Server instance (io) not initialized.");
  }
}

/**
 * Kiểm tra user có đang mở web (còn socket kết nối) hay không.
 * Dùng fetchSockets() để hoạt động đúng cả khi scale ngang qua Redis adapter.
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (!io) return false;
  try {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  } catch {
    return false;
  }
}

export function emitToCompany(companyCode: string, eventName: string, data: any) {
  if (io) {
    const room = `company:${companyCode}`;
    console.log(`[Socket.IO] Emitting event "${eventName}" to room: ${room}`);
    io.to(room).emit(eventName, data);
  } else {
    console.warn("[Socket.IO] Server instance (io) not initialized.");
  }
}

export function broadcastEvent(eventName: string, data: any) {
  if (io) {
    console.log(`[Socket.IO] Broadcasting event "${eventName}"`);
    io.emit(eventName, data);
  } else {
    console.warn("[Socket.IO] Server instance (io) not initialized.");
  }
}

