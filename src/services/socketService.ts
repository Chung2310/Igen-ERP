import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private messageCallbacks: Array<(data: { message: any; conversation: any }) => void> = [];
  private conversationCallbacks: Array<(conversation: any) => void> = [];

  connect(token: string) {
    if (this.socket?.connected) {
      console.log("[SocketService] Already connected.");
      return;
    }

    // Determine the socket server URL (same host in local/production)
    const socketUrl = window.location.origin;
    console.log(`[SocketService] Connecting to ${socketUrl}...`);

    this.socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log(`[SocketService] Connected successfully (Socket ID: ${this.socket?.id})`);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[SocketService] Connection error:", error.message);
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("[SocketService] Disconnected:", reason);
    });

    // Listen to incoming messages
    this.socket.on("new_message", (data: { message: any; conversation: any }) => {
      console.log("[SocketService] Received 'new_message' event:", data);
      this.messageCallbacks.forEach((cb) => cb(data));
    });

    // Listen to conversation updates
    this.socket.on("conversation_updated", (conversation: any) => {
      console.log("[SocketService] Received 'conversation_updated' event:", conversation);
      this.conversationCallbacks.forEach((cb) => cb(conversation));
    });
  }

  disconnect() {
    if (this.socket) {
      console.log("[SocketService] Disconnecting...");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onNewMessage(callback: (data: { message: any; conversation: any }) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  onConversationUpdated(callback: (conversation: any) => void) {
    this.conversationCallbacks.push(callback);
    return () => {
      this.conversationCallbacks = this.conversationCallbacks.filter((cb) => cb !== callback);
    };
  }
}

export const socketService = new SocketService();
