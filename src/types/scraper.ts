import { Page } from "@browserbasehq/stagehand";
import { JobListing } from "./listing";

export interface Scraper {
  page?: Page;

  init(): Promise<void>;
  getJobListings(): Promise<JobListing[]>;
}
