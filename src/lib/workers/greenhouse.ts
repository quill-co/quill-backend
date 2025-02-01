import { JobListing } from "../../types/listing";
import { ProfileManager } from "../../util/profiles";
import { BaseWorker } from "./base";

export default class GreenhouseWorker extends BaseWorker {
  constructor() {
    super();
  }

  async apply(listing: JobListing): Promise<void> {
    this.log(`Applying to ${listing.title} at ${listing.company}`);

    const { page } = this.stagehand;

    await page.goto(listing.url);

    const profile = ProfileManager.loadLatestProfile();

    if (!profile) {
      this.log("No profile found");
      return;
    }

    await page.act("Click on the apply button");

    const formCandidates = await page.observe({
      instruction: `Fill in the form with the values provided in the JSON object:\n${JSON.stringify(
        profile,
        null,
        2
      )}`,
      returnAction: true,
      onlyVisible: true,
    });

    for (const candidate of formCandidates) {
      await page.act(candidate);
    }

    await page.waitForTimeout(100000);

    await this.stagehand.close();
  }
}
