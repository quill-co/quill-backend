import { Profile, ProfileSchema } from "../../types/profile";
import { anthropic } from "@ai-sdk/anthropic";
import { deepseek } from "@ai-sdk/deepseek";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { exec } from "child_process";
import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const PROFILES_DIR = join(process.cwd(), "bin", "data", "profiles");

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

  private async parseTextToProfile(text: string): Promise<Profile> {
    const prompt = `Extract structured information from this resume text into a JSON object.

Resume text:
${text}

Required format:
{
  "name": "Full name of the candidate",
  "contactInfo": {
    "email": "Email address (if not found, use 'not provided')",
    "phone": "Phone number (if not found, use 'not provided')",
    "address": {
      "street": "Street address or 'not provided'",
      "city": "City name or closest major city",
      "state": "State/Province",
      "zip": "Postal/ZIP code or 'not provided'",
      "country": "Country (default to 'USA' if not specified)"
    }
  },
  "experiences": [
    {
      "company": "Company name",
      "position": "Job title",
      "startDate": "Start date in YYYY-MM format",
      "description": "Full job description"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description"
    }
  ],
  "resumeUrl": "Full URL including https:// (use https://example.com/resume if not found)",
  "summary": "Professional summary or first paragraph of experience",
  "skills": ["Skill 1", "Skill 2", "..."],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree name and major",
      "startDate": "Start date in YYYY-MM format"
    }
  ],
  "protectedVeteran": false,
  "race": "Prefer not to say",
  "needsSponsorship": false
}

Rules:
1. Return ONLY the JSON object, no other text
2. Ensure dates are in YYYY-MM format
3. Include ALL fields, use placeholders for missing data
4. Use "Prefer not to say" for demographic info if not explicitly stated
5. Format text fields properly with correct capitalization
6. Remove any markdown or special formatting
7. Keep full descriptions for experience and projects
8. For resumeUrl, ALWAYS include https:// prefix (e.g., convert "sameel.dev" to "https://sameel.dev")`;

    try {
      const { text: response } = await generateText({
        model: this.getModelProvider(),
        temperature: 0,
        system:
          "You are a precise resume parser that extracts structured data from text. Output only valid JSON.",
        prompt: prompt,
      });

      if (!response) {
        throw new Error("No content received from AI provider");
      }

      // Clean and validate the response
      const cleanJson = response.replace(/```json\s*|\s*```/g, "").trim();
      if (!cleanJson.startsWith("{") || !cleanJson.endsWith("}")) {
        throw new Error("Response is not a JSON object");
      }

      try {
        const parsedData = JSON.parse(cleanJson);
        return ProfileSchema.parse(parsedData);
      } catch (parseError) {
        console.error("Raw AI response:", response);
        throw parseError;
      }
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
      await execAsync(`${pythonPath} --version`).catch(() => {
        throw new Error(
          "Python not found in virtual environment. Please ensure Python is installed."
        );
      });

      // Install pdfminer.six
      await execAsync(`${pipPath} install --upgrade pdfminer.six`).catch(() => {
        throw new Error(
          "Failed to install pdfminer.six. Please ensure pip is working."
        );
      });
    } catch (error) {
      throw new Error(
        `Failed to set up Python dependencies: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async extractTextFromPdf(pdfPath: string): Promise<string> {
    try {
      const pythonPath = join(process.cwd(), ".venv/bin/python");
      const escapedPath = pdfPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

      const pythonScript = `
from io import StringIO
from pdfminer.layout import LAParams
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.converter import TextConverter
from pdfminer.pdfpage import PDFPage

def convert_pdf_to_text(path):
    rsrcmgr = PDFResourceManager()
    retstr = StringIO()
    laparams = LAParams()
    device = TextConverter(rsrcmgr, retstr, laparams=laparams)
    with open(path, 'rb') as fp:
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        for page in PDFPage.get_pages(fp):
            interpreter.process_page(page)
    text = retstr.getvalue()
    device.close()
    retstr.close()
    return text

try:
    text = convert_pdf_to_text('${escapedPath}')
    if not text.strip():
        raise Exception("No text content found in PDF")
    print(text)
except Exception as e:
    import sys
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
      `.trim();

      const tempScriptPath = join(process.cwd(), "temp_script.py");
      await writeFile(tempScriptPath, pythonScript, "utf-8");

      try {
        const { stdout, stderr } = await execAsync(
          `${pythonPath} ${tempScriptPath}`
        );

        if (stderr) {
          throw new Error(stderr);
        }

        const extractedText = stdout.trim();
        if (!extractedText) {
          throw new Error("No text content could be extracted from the PDF");
        }

        return extractedText;
      } finally {
        await unlink(tempScriptPath).catch(console.error);
      }
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  private async saveProfile(profile: Profile): Promise<string> {
    // Create profiles directory if it doesn't exist
    if (!existsSync(PROFILES_DIR)) {
      await mkdir(PROFILES_DIR, { recursive: true });
    }

    // Generate filename from profile name
    const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const filePath = join(PROFILES_DIR, `${safeName}.json`);

    // Save profile to file
    await writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");
    return filePath;
  }

  async parseResume(pdfPath: string): Promise<Profile> {
    await this.setupPythonDependencies();
    const text = await this.extractTextFromPdf(pdfPath);
    const profile = await this.parseTextToProfile(text);
    await this.saveProfile(profile);
    return profile;
  }

  static async parseDefaultResume(options: ParserOptions): Promise<Profile> {
    const parser = new Parser(options);
    const defaultResumePath = join(process.cwd(), "bin", "resume.pdf");
    return parser.parseResume(defaultResumePath);
  }
}
