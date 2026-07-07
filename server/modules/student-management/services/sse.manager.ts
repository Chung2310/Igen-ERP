import { Response } from "express";
import { logger } from "../config/logger";

export class SSEManager {
  private connections = new Map<string, Response[]>();

  addConnection(ownerId: string, res: Response) {
    if (!this.connections.has(ownerId)) {
      this.connections.set(ownerId, []);
    }
    this.connections.get(ownerId)!.push(res);
    logger.info(`[SSE] New client connected for ownerId: ${ownerId}. Active connections: ${this.connections.get(ownerId)!.length}`);
  }

  removeConnection(ownerId: string, res: Response) {
    if (!this.connections.has(ownerId)) return;
    const clients = this.connections.get(ownerId)!;
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
      logger.info(`[SSE] Client disconnected for ownerId: ${ownerId}. Active connections: ${clients.length}`);
    }
    if (clients.length === 0) {
      this.connections.delete(ownerId);
    }
  }

  broadcast(ownerId: string, event: string, data: unknown) {
    const clients = this.connections.get(ownerId);
    if (!clients || clients.length === 0) {
      logger.warn(`[SSE] No active clients for ownerId: ${ownerId} to broadcast event: ${event}`);
      return;
    }
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach((client) => {
      client.write(message);
    });
    logger.info(`[SSE] Broadcasted event "${event}" to ${clients.length} clients of ownerId: ${ownerId}`);
  }
}

export const sseManager = new SSEManager();
