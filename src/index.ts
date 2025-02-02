// import { GoogleScraper } from "./lib/scraper/google";
// import GreenhouseWorker from "./lib/workers/greenhouse";
import dotenv from "dotenv";
import GreenhouseWorker from "./lib/workers/greenhouse";

dotenv.config();

(async () => {
  // const profile = await Parser.parseDefaultResume({
  //   provider: "openai",
  //   apiKey: process.env.OPENAI_API_KEY!,
  // });

  // console.log(profile);

  // const scraper = new GoogleScraper();
  // await scraper.init();
  // const listings = await scraper.getJobListings();
  // console.log(listings);

  const worker = new GreenhouseWorker();
  await worker.init();
  await worker.apply({
    title: "Software Engineering Intern - US - San Francisco, CA",
    company: "Clear",
    location: "New York, NY",
    description: "Software Engineering Intern - US - New York, NY",
    url: "https://boards.greenhouse.io/clear/jobs/6516361",
  });
})();
