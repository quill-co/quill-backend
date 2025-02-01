import { Page, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { PageNotInitializedError } from "../../types/error";
import { JobListing, JobListingSchema } from "../../types/listing";
import { Scraper } from "../../types/scraper";
import { createBrowser } from "../browser";
import { buildExtractionPrompt } from "../prompts";

export class GoogleScraper implements Scraper {
  page?: Page;
  stagehand?: Stagehand;

  constructor() {
    this.page = undefined;
    this.stagehand = undefined;
  }

  async init(): Promise<void> {
    this.stagehand = await createBrowser();
  }

  private buildSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  async getJobListings(): Promise<JobListing[]> {
    if (!this.stagehand || !this.page) {
      throw new PageNotInitializedError();
    }

    const searchUrl = this.buildSearchUrl(
      "united states software intern apply site:boards.greenhouse.io"
    );

    await this.page.goto(searchUrl);

    const { listings } = await this.page.extract({
      instruction: buildExtractionPrompt(),
      schema: z.object({
        listings: z.array(JobListingSchema),
      }),
    });

    await this.stagehand?.close();

    return listings;
  }
}
