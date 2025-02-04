import WebSocket, { WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { parse } from "url";
import logger from "@/lib/logger";

export interface Session {
  id: string;
  ws: WebSocket;
  lastPing: number;
  data: object;
}

export type Message = {
  type:
    | "log"
    | "error"
    | "status"
    | "session_init"
    | "message_received"
    | "broadcast"
    | "ping"
    | "pong"
    | "finished"
    | "job_listing";
  message?: string;
  status?: string;
  sessionId?: string;
  data?: object;
  timestamp?: number;
};

export class SocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, Session>;
  private pingInterval!: NodeJS.Timeout;
  private pendingClients: Set<string>;

  constructor(port: number) {
    this.sessions = new Map();
    this.pendingClients = new Set();
    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const { query } = parse(req.url || "", true);
      const requestedId = query.clientId as string;

      if (!requestedId) {
        logger.error("No client ID provided");
        ws.close();
        return;
      }

      this.pendingClients.delete(requestedId);

      const sessionId = requestedId;

      const session: Session = {
        id: sessionId,
        ws,
        lastPing: Date.now(),
        data: {},
      };

      this.sessions.set(sessionId, session);
      logger.info(`Client connected with session ID: ${sessionId}`);

      // Send session ID to client immediately after connection
      this.sendToClient(sessionId, {
        type: "session_init",
        sessionId: sessionId,
        timestamp: Date.now(),
      });

      ws.on("close", () => {
        this.sessions.delete(sessionId);
        logger.info(`Client disconnected: ${sessionId}`);
      });

      ws.on("message", (data: string) => {
        try {
          const message = JSON.parse(data);
          if (message.type === "ping") {
            session.lastPing = Date.now();
          } else {
            logger.info(
              `Received message from session ${session.id}:`,
              message
            );

            // Update session data if provided
            if (message.sessionData) {
              session.data = { ...session.data, ...message.sessionData };
            }

            // Echo back the received message with session info
            this.sendToClient(session.id, {
              type: "message_received",
              sessionId: session.id,
              data: message,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          logger.error(
            `Error handling message from session ${session.id}:`,
            error
          );
        }
      });
    });

    // Start ping interval
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.sessions.forEach((session, id) => {
        if (now - session.lastPing > 30000) {
          // 30 seconds timeout
          logger.warn(`Session ${id} timed out`);
          session.ws.close();
          this.sessions.delete(id);
        } else {
          session.ws.ping();
        }
      });
    }, 10000);
  }

  public registerPendingClient(clientId: string): void {
    this.pendingClients.add(clientId);
    logger.info(`Registered pending client: ${clientId}`);
  }

  public broadcast(message: Message): void {
    this.sessions.forEach((session) => {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(message));
      }
    });
  }

  public sendToClient(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info(`[${sessionId}]`, message);
      session.ws.send(JSON.stringify(message));
      // } else {
      //   logger.warn(
      //     `Failed to send message to client ${sessionId}: Client not found or not connected`
      //   );
    }
  }

  public closeClient(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ws.close();
      this.sessions.delete(sessionId);
    }
  }

  public close(): void {
    clearInterval(this.pingInterval);
    this.wss.close();
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public hasActiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!(session && session.ws.readyState === WebSocket.OPEN);
  }
}
