import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { parse } from "url";
import logger from "../logger";

interface Session {
  id: string;
  data: any;
  ws: WebSocket;
  lastPing: number;
}

export class SocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, Session>;
  private pingInterval!: NodeJS.Timeout;

  constructor(port: number) {
    this.sessions = new Map();

    this.wss = new WebSocketServer({
      port,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupServerEvents();
    this.startPingInterval();
  }

  private verifyClient(
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (res: boolean, code?: number, message?: string) => void
  ) {
    const { pathname } = parse(info.req.url || "");
    const sessionId = pathname?.slice(1); // Remove leading slash

    if (!sessionId) {
      callback(false, 400, "Session ID required");
      return;
    }

    callback(true);
  }

  private setupServerEvents() {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const { pathname } = parse(req.url || "");
      const sessionId = pathname?.slice(1) || "";

      const session: Session = {
        id: sessionId,
        data: {},
        ws,
        lastPing: Date.now(),
      };

      this.sessions.set(sessionId, session);
      logger.info(`Client connected with session ID: ${sessionId}`);

      ws.on("message", (message: string) =>
        this.handleMessage(session, message)
      );
      ws.on("close", () => this.handleClose(sessionId));
      ws.on("pong", () => this.handlePong(session));

      // Send initial session data
      this.sendToClient(session, {
        type: "session_start",
        sessionId,
        timestamp: Date.now(),
      });
    });
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.sessions.forEach((session, sessionId) => {
        if (now - session.lastPing > 30000) {
          // 30 seconds timeout
          logger.warn(`Session ${sessionId} timed out`);
          session.ws.terminate();
          this.sessions.delete(sessionId);
        } else {
          session.ws.ping();
        }
      });
    }, 15000); // Check every 15 seconds
  }

  private handleMessage(session: Session, message: string) {
    try {
      const data = JSON.parse(message.toString());
      logger.info(`Received message from session ${session.id}:`, data);

      // Update session data if provided
      if (data.sessionData) {
        session.data = { ...session.data, ...data.sessionData };
      }

      // Echo back the received message with session info
      this.sendToClient(session, {
        type: "message_received",
        sessionId: session.id,
        data: data,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error handling message from session ${session.id}:`, error);
    }
  }

  private handleClose(sessionId: string) {
    this.sessions.delete(sessionId);
    logger.info(`Client disconnected: ${sessionId}`);
  }

  private handlePong(session: Session) {
    session.lastPing = Date.now();
  }

  private sendToClient(session: Session, data: any) {
    try {
      session.ws.send(JSON.stringify(data));
    } catch (error) {
      logger.error(`Error sending to session ${session.id}:`, error);
    }
  }

  broadcast(data: any) {
    this.sessions.forEach((session) => {
      this.sendToClient(session, {
        type: "broadcast",
        data,
        timestamp: Date.now(),
      });
    });
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public close() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
}
