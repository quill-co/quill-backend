// import { GoogleScraper } from "./lib/scraper/google";
import GreenhouseWorker from "./lib/workers/greenhouse";
import { Parser } from "./lib/resume/parse";

(async () => {
  const profile = await Parser.parseDefaultResume({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY!,
  });

  console.log(profile);

  // const scraper = new GoogleScraper();
  // await scraper.init();
  // const listings = await scraper.getJobListings();
  // console.log(listings);

  const worker = new GreenhouseWorker();
  await worker.init();
  await worker.apply({
    title: "Software Engineering Intern - US - San Francisco, CA",
    company: "Samsara",
    location: "San Francisco, CA",
    description:
      "About our Software Engineering Internships: We are seeking early-in-career software engineers to join various engineering teams for 12 weeks in Summer 2025!",
    url: "https://boards.greenhouse.io/samsara/jobs/6295077?utm_source=General+Catalyst+job+board&utm_medium=getro.com&gh_src=General+Catalyst+job+board",
  });
})();
