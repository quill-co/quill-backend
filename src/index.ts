// import { GoogleScraper } from "./lib/scraper/google";
// import GreenhouseWorker from "./lib/workers/greenhouse";
import dotenv from "dotenv";
import GreenhouseWorker from "./lib/workers/greenhouse";
import { SocketServer } from "./lib/socket/socket";

dotenv.config();

(async () => {
  try {
    const socketServer = new SocketServer(
      parseInt(process.env.SOCKET_PORT || "80")
    );

    // Generate and register a client ID
    const clientId = crypto.randomUUID();
    socketServer.registerPendingClient(clientId);

    console.log("Client ID for testing: ", clientId);

    // Wait for client connection and ensure it stays connected
    const waitForClient = async (
      maxWaitMs: number = 30000
    ): Promise<boolean> => {
      const startTime = Date.now();
      let connected = false;

      while (Date.now() - startTime < maxWaitMs) {
        if (socketServer.hasActiveSession(clientId)) {
          if (!connected) {
            console.log("Client connected successfully!");
            connected = true;
          }
          // Verify the connection is still active
          const session = socketServer.getSession(clientId);
          if (!session || session.ws.readyState !== 1) {
            // WebSocket.OPEN = 1
            console.log("Client disconnected, waiting for reconnection...");
            connected = false;
          }
        } else if (connected) {
          console.log("Lost connection, waiting for client to reconnect...");
          connected = false;
        }

        if (connected) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Increased interval
      }
      return false;
    };

    console.log("Waiting for client connection...");
    let clientConnected = await waitForClient();

    if (!clientConnected) {
      throw new Error("Client failed to connect within timeout period");
    }

    // Verify connection is still active before proceeding
    if (!socketServer.hasActiveSession(clientId)) {
      throw new Error("Client disconnected before worker could start");
    }

    const worker = new GreenhouseWorker(socketServer, clientId);
    await worker.init();

    await worker.apply({
      title: "Software Engineering Intern - US - San Francisco, CA",
      company: "Clear",
      location: "New York, NY",
      description: "Software Engineering Intern - US - New York, NY",
      url: "https://boards.greenhouse.io/clear/jobs/6516361",
    });
  } catch (error) {
    console.error("Application failed:", error);
    process.exit(1);
  }
})();
