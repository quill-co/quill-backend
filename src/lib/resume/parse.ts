import { Profile, ProfileSchema } from "../../types/profile";

import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { deepseek } from "@ai-sdk/deepseek";
import { ExecException } from "child_process";

const execAsync = promisify(exec);

export type SupportedModel = "openai" | "anthropic" | "google" | "deepseek";

export interface ParserOptions {
	provider: SupportedModel;
	model?: string;
	temperature?: number;
	apiKey: string;
	pythonPath?: string;
}

export class Parser {
	private provider: SupportedModel;
	private model: string;
	private temperature: number;
	private apiKey: string;
	private pythonPath: string;

	constructor(options: ParserOptions) {
		this.provider = options.provider;
		this.apiKey = options.apiKey;
		this.pythonPath = options.pythonPath || "python";

		// Set default models based on provider
		const defaultModels: Record<SupportedModel, string> = {
			openai: "gpt-4",
			anthropic: "claude-3-opus-20240229",
			google: "gemini-pro",
			deepseek: "deepseek-chat",
		};

		this.model = options.model || defaultModels[this.provider];
		this.temperature = options.temperature || 0;
	}

	private getModelProvider() {
		switch (this.provider) {
			case "openai":
				return openai(this.model);
			case "anthropic":
				return anthropic(this.model);
			case "google":
				return google(this.model);
			case "deepseek":
				return deepseek(this.model);
			default:
				throw new Error(`Unsupported provider: ${this.provider}`);
		}
	}

	private async parseMarkdownToProfile(markdown: string): Promise<Profile> {
		const prompt = `
Parse the following resume markdown into a structured JSON object.
The JSON must include ALL of these required fields:
- name (string)
- contactInfo (object with required email, phone, and address fields)
  - address must include street, city, state, zip, and country
- experiences (array of objects with company, position, startDate, description)
- projects (array of objects with name and description as strings)
- resumeUrl (must be a valid URL starting with http:// or https://)
- summary (string)
- skills (array of strings)
- education (array of objects with institution, degree, startDate)
- protectedVeteran (boolean)
- race (string)
- needsSponsorship (boolean)

Example structure:
{
  "name": "John Doe",
  "contactInfo": {
    "email": "john@example.com",
    "phone": "(123) 456-7890",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105",
      "country": "USA"
    }
  },
  "experiences": [{
    "company": "Example Corp",
    "position": "Software Engineer",
    "startDate": "2020-01",
    "description": "Full-stack development"
  }],
  "projects": [{
    "name": "Project Name",
    "description": "Project description"
  }],
  "resumeUrl": "https://example.com/resume",
  "summary": "Experienced software engineer",
  "skills": ["JavaScript", "Python"],
  "education": [{
    "institution": "University Name",
    "degree": "Bachelor's in Computer Science",
    "startDate": "2016-09"
  }],
  "protectedVeteran": false,
  "race": "Prefer not to say",
  "needsSponsorship": false
}

Resume markdown to parse:
${markdown}

IMPORTANT: 
1. Return ONLY the JSON object, with no markdown formatting, no backticks, and no additional text.
2. Ensure ALL required fields are included with appropriate values.
3. All URL fields (resumeUrl, linkedin, github, etc.) must be valid URLs starting with http:// or https://.
4. If a URL is not found in the resume, use a placeholder like https://example.com/resume.`;

		try {
			const { text } = await generateText({
				model: this.getModelProvider(),
				temperature: this.temperature,
				system:
					"You are a resume parser that converts markdown resumes into structured JSON data. Always return valid JSON without any markdown formatting or additional text. Ensure all required fields are present with appropriate values, using placeholder URLs when needed.",
				prompt: prompt,
			});

			if (!text) {
				throw new Error("No content received from AI provider");
			}

			// Clean the response to ensure it's valid JSON
			const cleanJson = text.replace(/```json\s*|\s*```/g, "").trim();
			const parsedData = JSON.parse(cleanJson);
			return ProfileSchema.parse(parsedData);
		} catch (error) {
			throw new Error(
				`Failed to parse AI response into valid Profile: ${error}`
			);
		}
	}

	private async setupPythonDependencies(): Promise<void> {
		try {
			const pythonPath = join(process.cwd(), ".venv/bin/python");
			const pipPath = join(process.cwd(), ".venv/bin/pip");

			// Check Python version
			await new Promise<void>((resolve, reject) => {
				exec(
					`${pythonPath} --version`,
					(error: ExecException | null, stdout: string) => {
						if (error) {
							reject(
								new Error(
									"Failed to check Python version. Please ensure Python is installed on your system."
								)
							);
							return;
						}
						resolve();
					}
				);
			});

			// Install required Python package
			await new Promise<void>((resolve, reject) => {
				exec(`${pipPath} install markitdown`, (error: ExecException | null) => {
					if (error) {
						reject(
							new Error(
								"Failed to install Python dependencies. Please ensure pip is installed and working."
							)
						);
						return;
					}
					resolve();
				});
			});
		} catch (error) {
			throw new Error(
				`Failed to set up Python dependencies: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	private async convertPdfToMarkdown(pdfPath: string): Promise<string> {
		try {
			const pythonPath = join(process.cwd(), ".venv/bin/python");

			// Escape the file path for Python
			const escapedPath = pdfPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

			const pythonScript = `
import sys
sys.path.append('${process.cwd()}/.venv/lib/python3.*/site-packages')
from markitdown import MarkItDown
md = MarkItDown()
result = md.convert('${escapedPath}')
print(result.text_content)
			`.trim();

			// Write the Python script to a temporary file
			const tempScriptPath = join(process.cwd(), "temp_script.py");
			await writeFile(tempScriptPath, pythonScript, "utf-8");

			try {
				const { stdout, stderr } = await execAsync(
					`${pythonPath} ${tempScriptPath}`
				);

				if (stderr) {
					console.warn("Warning from Python process:", stderr);
				}

				return stdout.trim();
			} finally {
				// Clean up the temporary file
				await unlink(tempScriptPath).catch(console.error);
			}
		} catch (error) {
			throw new Error(`Failed to convert PDF to markdown: ${error}`);
		}
	}

	async parseResume(pdfPath: string): Promise<Profile> {
		const markdown = await this.convertPdfToMarkdown(pdfPath);
		const profile = await this.parseMarkdownToProfile(markdown);
		return profile;
	}

	static async parseDefaultResume(options: ParserOptions): Promise<Profile> {
		const parser = new Parser(options);
		const defaultResumePath = join(process.cwd(), "config", "resume.pdf");
		return parser.parseResume(defaultResumePath);
	}
}
