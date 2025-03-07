import path from "path";
import { JobListing } from "@/types/listing";
import { ProfileManager } from "@/util/profiles";
import { SocketServer } from "@/lib/socket/socket";
import { BaseWorker } from "./base";

export default class GreenhouseWorker extends BaseWorker {
  constructor(socketServer: SocketServer, clientId: string) {
    super(socketServer, clientId);
  }

  async apply(listing: JobListing): Promise<void> {
    this.log(`Applying to ${listing.title} at ${listing.company}`);
    this.listing = listing;
    const { page } = this.stagehand;

    await this.updateStatus("Getting ready...");

    await page.goto(listing.url);

    const profile = await ProfileManager.loadLatestProfile();

    if (!profile) {
      this.log("No profile found");
      return;
    }

    await this.updateStatus("Filling out your personal information...");

    await page.getByLabel("First Name *").fill(profile.name.split(" ")[0]);
    await page.getByLabel("Last Name *").fill(profile.name.split(" ")[1]);
    await page.getByLabel("Email *").fill(profile.contactInfo.email);
    await page.getByLabel("Phone").fill(profile.contactInfo.phone);

    if (profile.contactInfo.linkedin) {
      await page
        .getByLabel("LinkedIn Profile")
        .fill(profile.contactInfo.linkedin);
    }
    if (profile.contactInfo.website) {
      await page.getByLabel("Website").fill(profile.contactInfo.website);
    }

    await this.updateStatus("Uploading your resume...");

    const resumePath = path.join(process.cwd(), "bin/resume.pdf");
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error("Could not find file input");
    }
    await fileInput.setInputFiles(resumePath);

    // Wait for upload to complete
    await page.waitForSelector(".chosen", { state: "visible" });
    await page.waitForSelector(".progress-bar", { state: "hidden" });

    await this.updateStatus("Adding your education details...");

    // Fill in education institution
    await page.click("#select2-chosen-1");
    const institution = profile.education[0].institution;
    const words = institution.split(" ");
    let found = false;

    for (let i = 1; i <= words.length && !found; i++) {
      const partial = words.slice(0, i).join(" ");
      await page.locator("#s2id_autogen1_search").fill(partial);
      await page.waitForTimeout(500);

      const results = await page.locator(".select2-results li").count();
      if (results > 0) {
        found = true;
        await page.keyboard.press("Enter");
      }
    }

    if (!found) {
      this.log("Could not find institution match");
    }
    // Fill in degree type
    await page.click("#select2-chosen-2");
    await page
      .locator("#s2id_autogen2_search")
      .pressSequentially(profile.education[0].degree);
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");

    await this.finish();

    // Omit the application submission as to not spam the site
  }
}
