import { Profile, ProfileSchema } from "../types/profile";
import { readFile, writeFile, mkdir, readdir, unlink, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const PROFILES_DIR = join(process.cwd(), "bin", "data", "profiles");

export class ProfileManager {
  /**
   * Save a profile to a JSON file
   * @param profile The profile to save
   * @param filename Optional filename (defaults to the person's name)
   * @returns The path to the saved file
   */
  static async saveProfile(
    profile: Profile,
    filename?: string
  ): Promise<string> {
    // Create profiles directory if it doesn't exist
    if (!existsSync(PROFILES_DIR)) {
      await mkdir(PROFILES_DIR, { recursive: true });
    }

    // Generate filename from profile name if not provided
    const safeName =
      filename || profile.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const filePath = join(PROFILES_DIR, `${safeName}.json`);

    // Save profile to file
    await writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");
    return filePath;
  }

  /**
   * Load a profile from a JSON file (private method)
   */
  private static async loadProfileFromFile(filename: string): Promise<Profile> {
    const filePath = join(PROFILES_DIR, filename);
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return ProfileSchema.parse(data);
  }

  /**
   * Load the most recently modified profile
   * @returns The most recent profile, or null if no profiles exist
   */
  static async loadLatestProfile(): Promise<Profile | null> {
    try {
      const profiles = await this.listProfiles();
      if (profiles.length === 0) {
        return null;
      }

      // Get the most recently modified profile
      const profileStats = await Promise.all(
        profiles.map(async (filename) => {
          const filePath = join(PROFILES_DIR, filename);
          const stats = await stat(filePath);
          return { filename, stats };
        })
      );

      const mostRecent = profileStats.reduce((latest, current) => {
        if (!latest || current.stats.mtime > latest.stats.mtime) {
          return current;
        }
        return latest;
      });

      return this.loadProfileFromFile(mostRecent.filename);
    } catch (error) {
      console.error("Error loading latest profile:", error);
      return null;
    }
  }

  /**
   * List all saved profiles
   * @returns Array of profile filenames
   */
  static async listProfiles(): Promise<string[]> {
    try {
      if (!existsSync(PROFILES_DIR)) {
        return [];
      }
      const files = await readdir(PROFILES_DIR);
      return files.filter((file) => file.endsWith(".json"));
    } catch (error) {
      console.error("Error listing profiles:", error);
      return [];
    }
  }

  /**
   * Delete a profile
   * @param filename The name of the profile file to delete
   */
  static async deleteProfile(filename: string): Promise<void> {
    const filePath = join(PROFILES_DIR, filename);
    await unlink(filePath);
  }
}
