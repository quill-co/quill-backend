// import { GoogleScraper } from "./lib/scraper/google";
// import GreenhouseWorker from "./lib/workers/greenhouse";
import dotenv from "dotenv";
import { Parser } from "./lib/resume/parse";
import GreenhouseWorker from "./lib/workers/greenhouse";
import { GoogleScraper } from "./lib/scraper/google";

dotenv.config();

(async () => {
  const profile = await Parser.parseDefaultResume({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY!,
  });

  console.log(profile);

  const scraper = new GoogleScraper();
  await scraper.init();
  const listings = await scraper.getJobListings();
  console.log(listings);

  const worker = new GreenhouseWorker();
  await worker.init();
  await worker.apply(listings[0]);
})();
