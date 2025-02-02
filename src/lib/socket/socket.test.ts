import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { SocketServer } from "./socket";
import WebSocket from "ws";

describe("SocketServer", () => {
  let server: SocketServer;
  let activeConnections: WebSocket[];

  beforeEach(() => {
    server = new SocketServer(parseInt(process.env.PORT || "80"));
    activeConnections = [];
  });

  afterEach(async () => {
    // Close all active connections
    activeConnections.forEach((ws) => ws.close());
    // Wait for connections to close
    await new Promise((resolve) => setTimeout(resolve, 100));
    server.close();
  });

  function createConnection(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${parseInt(process.env.PORT || "80")}/${sessionId}`
      );
      activeConnections.push(ws);

      ws.on("open", () => resolve(ws));
      ws.on("error", reject);

      // Add timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for session ${sessionId}`));
      }, 1000);

      ws.once("open", () => clearTimeout(timeout));
    });
  }

  it("should connect with a valid session ID", async () => {
    const sessionId = "test-session";
    const ws = await createConnection(sessionId);
    expect(server.getSession(sessionId)).toBeDefined();
    ws.close();
  });

  it("should handle session data updates", (done) => {
    const sessionId = "test-session-data";
    createConnection(sessionId).then((ws) => {
      const testData = { name: "Test User", age: 25 };

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "message_received") {
          const session = server.getSession(sessionId);
          expect(session?.data).toEqual(testData);
          ws.close();
          done();
        }
      });

      ws.send(JSON.stringify({ sessionData: testData }));
    });
  }, 10000);

  it("should broadcast messages to all connected clients", async () => {
    const sessionId1 = "test-session-1";
    const sessionId2 = "test-session-2";

    // Create both connections first
    const [ws1, ws2] = await Promise.all([
      createConnection(sessionId1),
      createConnection(sessionId2),
    ]);

    const broadcastData = { message: "Hello everyone!" };
    let receivedCount = 0;

    return new Promise<void>((resolve) => {
      const messageHandler = (data: WebSocket.RawData) => {
        const message = JSON.parse(data.toString());
        if (message.type === "broadcast") {
          expect(message.data).toEqual(broadcastData);
          receivedCount++;
          if (receivedCount === 2) {
            ws1.close();
            ws2.close();
            resolve();
          }
        }
      };

      ws1.on("message", messageHandler);
      ws2.on("message", messageHandler);

      // Send broadcast after setting up listeners
      server.broadcast({ type: "broadcast", message: "Test message" });
    });
  }, 10000);

  it("should handle client disconnection", async () => {
    const sessionId = "test-session-disconnect";
    const ws = await createConnection(sessionId);

    expect(server.getSession(sessionId)).toBeDefined();
    ws.close();

    // Wait for disconnection to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(server.getSession(sessionId)).toBeUndefined();
  });
});
