import { GoogleScraper } from "./google";

describe("GoogleScraper", () => {
  it("should get job listings", async () => {
    const scraper = new GoogleScraper();
    await scraper.init();
    const listings = await scraper.getJobListings();
    console.log(listings);
  }, 60000); // Increase timeout to 30 seconds
});
