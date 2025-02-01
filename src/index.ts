import { GoogleScraper } from "./lib/scraper/google";

(async () => {
  const scraper = new GoogleScraper();
  await scraper.init();
  const listings = await scraper.getJobListings();
  console.log(listings);
})();
