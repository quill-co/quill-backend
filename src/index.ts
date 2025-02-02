// import { GoogleScraper } from "./lib/scraper/google";
// import GreenhouseWorker from "./lib/workers/greenhouse";
import dotenv from "dotenv";
import { GoogleScraper } from "./lib/scraper/google";
import { SocketServer } from "./lib/socket/socket";
import GreenhouseWorker from "./lib/workers/greenhouse";

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

    const scraper = new GoogleScraper();
    await scraper.init();
    const listings = await scraper.getJobListings();

    const worker = new GreenhouseWorker(socketServer, clientId);
    await worker.init();

    await worker.apply(listings[0]);
  } catch (error) {
    console.error("Application failed:", error);
    process.exit(1);
  }
})();
