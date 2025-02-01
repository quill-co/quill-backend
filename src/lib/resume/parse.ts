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
      openai: "gpt-4o",
      anthropic: "claude-3.5-sonnet",
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
    const prompt = `You are a resume parser. Convert this markdown resume into a JSON object with EXACTLY these fields:
{
  "name": "string",
  "contactInfo": {
    "email": "string",
    "phone": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "country": "string"
    }
  },
  "experiences": [{"company": "string", "position": "string", "startDate": "string", "description": "string"}],
  "projects": [{"name": "string", "description": "string"}],
  "resumeUrl": "https://example.com/resume",
  "summary": "string",
  "skills": ["string"],
  "education": [{"institution": "string", "degree": "string", "startDate": "string"}],
  "protectedVeteran": false,
  "race": "string",
  "needsSponsorship": false
}

RULES:
1. Return ONLY valid JSON
2. Do not include ANY explanatory text
3. Use https://example.com/resume if no URL found
4. Use "Prefer not to say" for missing demographic info

RESUME TO PARSE:
${markdown}`;

    try {
      const { text } = await generateText({
        model: this.getModelProvider(),
        temperature: 0,
        system:
          "You are a JSON generator. Only output valid JSON objects. Never include explanatory text.",
        prompt: prompt,
      });

      if (!text) {
        throw new Error("No content received from AI provider");
      }

      // Clean and validate the response
      const cleanJson = text.replace(/```json\s*|\s*```/g, "").trim();
      if (!cleanJson.startsWith("{") || !cleanJson.endsWith("}")) {
        throw new Error("Response is not a JSON object");
      }

      const parsedData = JSON.parse(cleanJson);
      return ProfileSchema.parse(parsedData);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("AI response was not valid JSON");
      }
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
    const defaultResumePath = join(process.cwd(), "bin", "resume.pdf");
    return parser.parseResume(defaultResumePath);
  }
}
