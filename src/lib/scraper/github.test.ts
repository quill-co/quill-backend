import { GithubScraper } from "./google";

describe("GithubScraper", () => {
  it("should get job listings", async () => {
    const scraper = new GithubScraper();
    await scraper.init();
    const listings = await scraper.getJobListings();
    console.log(listings);
  }, 60000); // Increase timeout to 30 seconds
});
