import { GithubScraper } from "./lib/scraper/google";

(async () => {
  const scraper = new GithubScraper();
  await scraper.init();
  const listings = await scraper.getJobListings();
  console.log(listings);
})();
