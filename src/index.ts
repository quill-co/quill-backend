import { config } from "dotenv";
import { Parser } from "./lib/resume/parse";
import { join } from "path";

// Load environment variables from .env file
config();

async function main() {
	try {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is not set");
		}

		// Initialize parser with your OpenAI API key
		const parser = new Parser({
			provider: "openai",
			apiKey,
		});

		// Path to your resume (assuming it's in the config directory)
		const resumePath = join(__dirname, "../config/Dominic_Magats_Resume.pdf");

		console.log("Parsing resume...");
		const profile = await parser.parseResume(resumePath);

		// Pretty print the result
		console.log("\nParsed Profile:");
		console.log(JSON.stringify(profile, null, 2));
	} catch (error) {
		console.error("Error parsing resume:", error);
		process.exit(1);
	}
}

// Run the script
main();
