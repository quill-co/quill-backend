import path from "path";
import { JobListing } from "../../types/listing";
import { ProfileManager } from "../../util/profiles";
import { BaseWorker } from "./base";
import { SocketServer } from "../socket/socket";

export default class GreenhouseWorker extends BaseWorker {
  constructor(socketServer?: SocketServer, clientId?: string) {
    super(socketServer, clientId);
  }

  async apply(listing: JobListing): Promise<void> {
    try {
      this.log(`Applying to ${listing.title} at ${listing.company}`);
      if (this.socketServer && this.clientId) {
        this.socketServer.sendToClient(this.clientId, {
          type: "status",
          status: "applying",
        });
      }

      const { page } = this.stagehand;

      await page.goto(listing.url);

      const profile = await ProfileManager.loadLatestProfile();

      if (!profile) {
        this.log("No profile found");
        if (this.socketServer && this.clientId) {
          this.socketServer.sendToClient(this.clientId, {
            type: "error",
            message: "No profile found",
          });
        }
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

      // Fill education fields
      await page.getByLabel("School").click();
      await page.keyboard.type(profile.education[0].institution);
      await page.keyboard.press("Enter");

      await page.getByLabel("Degree").click();
      // Map degree to Greenhouse's options
      const degreeText = profile.education[0].degree.toLowerCase();
      let degreeOption = "Bachelor's Degree"; // Default
      if (
        degreeText.includes("bachelor") ||
        degreeText.includes("bs") ||
        degreeText.includes("b.s.")
      ) {
        degreeOption = "Bachelor's Degree";
      } else if (degreeText.includes("master")) {
        degreeOption = "Master's Degree";
      } else if (
        degreeText.includes("phd") ||
        degreeText.includes("doctor of philosophy")
      ) {
        degreeOption = "Doctor of Philosophy (Ph.D.)";
      } else {
        degreeOption = "Bachelor's Degree";
      }
      await page.keyboard.type(degreeOption);
      await page.keyboard.press("Enter");

      await page.getByRole("button", { name: "Submit Application" }).click();
      if (this.socketServer && this.clientId) {
        this.socketServer.sendToClient(this.clientId, {
          type: "status",
          status: "submitted",
        });
      }

      await page.waitForTimeout(1000);
      await this.finish();
    } catch (error) {
      if (this.socketServer && this.clientId) {
        this.socketServer.sendToClient(this.clientId, {
          type: "error",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
      throw error;
    }
  }
}
