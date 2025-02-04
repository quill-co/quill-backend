import { Stagehand } from "@browserbasehq/stagehand";
import { JobListing } from "@/types/listing";
import logger from "@/lib/logger";
import { SocketServer } from "@/lib/socket/socket";

export abstract class BaseWorker {
  private workerId: string;
  public stagehand: Stagehand;
  protected socketServer: SocketServer;
  protected clientId: string;
  protected listing!: JobListing;

  constructor(socketServer: SocketServer, clientId: string) {
    this.workerId = crypto.randomUUID();
    this.stagehand = new Stagehand({
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      env: process.env.ENVIRONMENT === "development" ? "LOCAL" : "BROWSERBASE",
    });
    this.socketServer = socketServer;
    this.clientId = clientId;
  }

  async init() {
    await this.stagehand.init();
  }

  log(message: string) {
    logger.info(`[${this.workerId}] ${message}`);
    if (this.socketServer && this.clientId) {
      this.socketServer.sendToClient(this.clientId, { type: "log", message });
    }
  }

  async finish() {
    logger.info("Worker finished");
    if (this.socketServer && this.clientId) {
      this.socketServer.sendToClient(this.clientId, {
        type: "finished",
        data: {
          company: this.listing.company,
          jobTitle: this.listing.title,
          url: this.listing.url,
          location: this.listing.location,
        },
      });
      this.socketServer.closeClient(this.clientId);
    }
    await this.stagehand.close();
  }

  async updateStatus(status: string) {
    if (this.socketServer && this.clientId) {
      this.socketServer.sendToClient(this.clientId, {
        type: "status",
        data: {
          company: this.listing.company,
          jobTitle: this.listing.title,
          url: this.listing.url,
          location: this.listing.location,
          status: status,
        },
      });
    }
  }

  abstract apply(listing: JobListing): Promise<void>;
}
