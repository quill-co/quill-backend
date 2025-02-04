import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { PageNotInitializedError } from "@/types/error";
import { JobListing, JobListingSchema } from "@/types/listing";
import { Scraper } from "@/types/scraper";
import { createBrowser } from "@/lib/browser";
import { buildExtractionPrompt } from "@/lib/prompts";

export class GoogleScraper implements Scraper {
  stagehand?: Stagehand;

  constructor() {
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
    if (!this.stagehand) {
      throw new PageNotInitializedError();
    }

    const { page } = this.stagehand;

    const searchUrl = this.buildSearchUrl(
      "united states docugami software intern apply site:boards.greenhouse.io"
    );

    await page.goto(searchUrl);

    const { listings } = await page.extract({
      instruction: buildExtractionPrompt(),
      schema: z.object({
        listings: z.array(JobListingSchema),
      }),
    });

    await this.stagehand?.close();

    return listings;
  }
}
