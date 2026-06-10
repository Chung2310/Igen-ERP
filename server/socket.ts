import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { UserModel } from "./model/user.model";

let io: SocketIOServer | null = null;

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

export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true
    }
  });

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
    
    // Đọc Page ID từ thông tin liên kết của user hoặc fallback về cấu hình mặc định trong file .env
    const pageId = (user?.facebookIntegration?.isConnected && user.facebookIntegration.pageId) 
      || process.env.FB_PAGE_ID;
      
    const oaId = (user?.zaloIntegration?.isConnected && user.zaloIntegration.oaId)
      || process.env.ZALO_OA_ID;

    console.log(`[Socket.IO] Client connected: ${user?.email || "Unknown"} (Socket: ${socket.id})`);

    if (pageId) {
      const room = `page:${pageId}`;
      socket.join(room);
      console.log(`[Socket.IO] User ${user?.email} joined room: ${room}`);
    }

    if (oaId) {
      const room = `page:${oaId}`;
      socket.join(room);
      console.log(`[Socket.IO] User ${user?.email} joined room: ${room}`);
    }

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
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
