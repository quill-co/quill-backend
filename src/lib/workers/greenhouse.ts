import path from "path";
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

    const profile = await ProfileManager.loadLatestProfile();

    if (!profile) {
      this.log("No profile found");
      return;
    }

    await page.getByLabel("First Name *").fill(profile.name.split(" ")[0]);
    await page.getByLabel("Last Name *").fill(profile.name.split(" ")[1]);
    await page.getByLabel("Email *").fill(profile.contactInfo.email);
    await page.getByLabel("Phone *").fill(profile.contactInfo.phone);

    await page
      .getByLabel("Location (City)")
      .fill(profile.contactInfo.address.city);
    if (profile.contactInfo.linkedin) {
      await page
        .getByLabel("LinkedIn Profile")
        .fill(profile.contactInfo.linkedin);
    }
    if (profile.contactInfo.website) {
      await page.getByLabel("Website").fill(profile.contactInfo.website);
    }

    // Upload resume
    const resumePath = path.join(process.cwd(), "bin/resume.pdf");
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error("Could not find file input");
    }
    await fileInput.setInputFiles(resumePath);

    // Wait for upload to complete
    await page.waitForSelector(".chosen", { state: "visible" });
    await page.waitForSelector(".progress-bar", { state: "hidden" });

    await page.getByRole("button", { name: "Submit Application" }).click();

    await page.waitForTimeout(100000);

    await this.stagehand.close();
  }
}
