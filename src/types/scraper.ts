import { Page, Stagehand } from "@browserbasehq/stagehand";
import { JobListing } from "./listing";

export interface Scraper {
  stagehand?: Stagehand;
  page?: Page;

  init(): Promise<void>;
  getJobListings(): Promise<JobListing[]>;
}
