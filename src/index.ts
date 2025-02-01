import { config } from "dotenv";
import { Parser } from "./lib/resume/parse";
import { ProfileManager } from "./util/profiles";
import { join } from "path";

// Load environment variables from .env file
config();

async function parseResume() {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY environment variable is not set");
	}

	// Initialize parser with your OpenAI API key
	const parser = new Parser({
		provider: "openai",
		apiKey,
	});

	// Path to your resume
	const resumePath = join(__dirname, "../bin/Dominic_Magats_Resume.pdf");

	console.log("Parsing resume...");
	const profile = await parser.parseResume(resumePath);

	// Save the profile
	const savedPath = await ProfileManager.saveProfile(profile);
	console.log(`\nProfile saved to: ${savedPath}`);

	return profile;
}

async function loadAndDisplayProfile(filename: string) {
	try {
		console.log(`\nLoading profile: ${filename}`);
		const profile = await ProfileManager.loadProfile(filename);
		console.log("\nLoaded Profile:");
		console.log(JSON.stringify(profile, null, 2));
	} catch (error) {
		console.error(`Error loading profile: ${error}`);
	}
}

async function main() {
	try {
		// List existing profiles
		const profiles = await ProfileManager.listProfiles();
		console.log("Existing profiles:", profiles);

		if (profiles.length > 0) {
			// Load and display the first profile
			await loadAndDisplayProfile(profiles[0]);
		} else {
			// If no profiles exist, parse the resume
			console.log("\nNo existing profiles found. Parsing resume...");
			const profile = await parseResume();
			console.log("\nParsed Profile:");
			console.log(JSON.stringify(profile, null, 2));
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

// Run the script
main();
