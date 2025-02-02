import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const clientId = process.argv[2];
if (!clientId) {
  console.error("Please provide a client ID as an argument");
  process.exit(1);
}

const port = process.env.SOCKET_PORT || "80";
const ws = new WebSocket(`ws://localhost:${port}?clientId=${clientId}`);

ws.on("open", () => {
  console.log("Connected to server");
});

ws.on("message", (data: string) => {
  try {
    const message = JSON.parse(data);
    console.log("Received:", message);

    // Respond to ping messages to keep the connection alive
    if (message.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  } catch (error) {
    console.error("Failed to parse message:", error);
  }
});

ws.on("close", () => {
  console.log("Disconnected from server");
  process.exit(0);
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
  process.exit(1);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nClosing connection...");
  ws.close();
});

console.log(`Connecting with client ID: ${clientId}`);
