import { Page } from "@browserbasehq/stagehand";
import { PageNotInitializedError } from "../../types/error";
import { JobListing, JobListingSchema } from "../../types/listing";
import { Scraper } from "../../types/scraper";
import { createBrowser } from "../browser";
import { z } from "zod";

export class GithubScraper implements Scraper {
  page?: Page;

  constructor() {
    this.page = undefined;
  }

  async init(): Promise<void> {
    this.page = await createBrowser();
  }

  private buildSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  async getJobListings(): Promise<JobListing[]> {
    if (!this.page) {
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
      useTextExtract: true,
    });

    logger.info(`Found ${listings.length} job listings`);
    console.log(listings);

    await this.stagehand.close();

    return listings;
  }
}
