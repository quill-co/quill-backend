import { Stagehand } from "@browserbasehq/stagehand";
import { JobListing } from "../../types/listing";
import logger from "../logger";

export abstract class BaseWorker {
  private workerId: string;
  public stagehand: Stagehand;

  constructor() {
    this.workerId = crypto.randomUUID();
    this.stagehand = new Stagehand({
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      env: process.env.BROWSER_ENV as "LOCAL" | "BROWSERBASE",
    });
  }

  async init() {
    await this.stagehand.init();
  }

  log(message: string) {
    logger.info(`[${this.workerId}] ${message}`);
  }

  async finish() {
    logger.info("Worker finished");
  }

  abstract apply(listing: JobListing): Promise<void>;
}
