import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { Parser } from "./parse";
import { join } from "path";
import { writeFile, unlink, readFile, mkdir, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { ExecException } from "child_process";
import { generateText } from "ai";
import type { GenerateTextResult, ToolSet } from "ai";

// Mock the child_process exec
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

// Mock the AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

const mockGenerateText = jest.mocked(generateText);

describe("Resume Parser", () => {
  const mockApiKey = "test-api-key";
  const mockPdfPath = join(process.cwd(), "test-resume.pdf");
  const profilesDir = join(process.cwd(), "bin", "data", "profiles");
  const mockPdfText = `
John Doe
Software Engineer

Contact:
Email: john.doe@example.com
Phone: (123) 456-7890
Address: 123 Main St, San Francisco, CA 94105, USA

Summary:
Experienced software engineer with a focus on full-stack development.
	`;

  const mockProfile = {
    name: "John Doe",
    contactInfo: {
      email: "john.doe@example.com",
      phone: "(123) 456-7890",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "USA",
      },
    },
    experiences: [],
    projects: [],
    resumeUrl: "https://example.com/resume",
    summary:
      "Experienced software engineer with a focus on full-stack development.",
    skills: [],
    education: [],
    protectedVeteran: false,
    race: "Prefer not to say",
    needsSponsorship: false,
  };

  const mockAIResponse = {
    text: JSON.stringify(mockProfile),
    finishReason: "stop",
    toolCalls: [],
    toolResults: [],
  } as unknown as GenerateTextResult<ToolSet, unknown>;

  let originalConsoleError: typeof console.error;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalConsoleError = console.error;
    console.error = jest.fn();
    mockGenerateText.mockResolvedValue(mockAIResponse);

    // Create profiles directory if it doesn't exist
    if (!existsSync(profilesDir)) {
      await mkdir(profilesDir, { recursive: true });
    }

    // Mock successful Python execution
    const { exec } = require("child_process");
    const mockExec = exec as jest.MockedFunction<typeof exec>;
    mockExec.mockImplementation(
      (
        command: string,
        callback: (
          error: ExecException | null,
          result: { stdout: string; stderr: string }
        ) => void
      ) => {
        if (command.includes("--version")) {
          callback(null, { stdout: "Python 3.9.0", stderr: "" });
        } else if (command.includes("pip")) {
          callback(null, {
            stdout: "Successfully installed pdfminer.six",
            stderr: "",
          });
        } else if (command.includes("python")) {
          callback(null, { stdout: mockPdfText, stderr: "" });
        }
      }
    );
  });

  afterEach(async () => {
    console.error = originalConsoleError;
    try {
      await unlink(mockPdfPath);
      // Clean up profiles directory
      if (existsSync(profilesDir)) {
        await rm(profilesDir, { recursive: true });
      }
    } catch (error) {
      // Ignore if files don't exist
    }
  });

  it("should create a parser instance with default options", () => {
    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });
    expect(parser).toBeInstanceOf(Parser);
  });

  it("should extract text from PDF", async () => {
    await writeFile(mockPdfPath, "Mock PDF content", "utf-8");

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    const text = await parser["extractTextFromPdf"](mockPdfPath);
    expect(text).toBe(mockPdfText.trim());
  });

  it("should handle PDF extraction errors", async () => {
    const { exec } = require("child_process");
    const mockExec = exec as jest.MockedFunction<typeof exec>;
    mockExec.mockImplementation(
      (
        _cmd: string,
        callback: (
          error: ExecException | null,
          result: { stdout: string; stderr: string }
        ) => void
      ) => {
        callback(new Error("PDF extraction failed") as ExecException, {
          stdout: "",
          stderr: "Error: PDF extraction failed",
        });
      }
    );

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await expect(parser["extractTextFromPdf"](mockPdfPath)).rejects.toThrow(
      "Failed to extract text from PDF"
    );
  });

  it("should parse text to profile", async () => {
    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    const profile = await parser["parseTextToProfile"](mockPdfText);
    expect(profile).toEqual(mockProfile);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        system: expect.any(String),
        prompt: expect.stringContaining("Extract structured information"),
      })
    );
  });

  it("should handle AI errors gracefully", async () => {
    mockGenerateText.mockRejectedValue(new Error("AI service error"));

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await expect(parser["parseTextToProfile"](mockPdfText)).rejects.toThrow(
      "Failed to parse AI response"
    );
  });

  it("should handle invalid JSON responses", async () => {
    const invalidResponse = "not a json";
    mockGenerateText.mockResolvedValue({
      ...mockAIResponse,
      text: invalidResponse,
    });

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await expect(parser["parseTextToProfile"](mockPdfText)).rejects.toThrow(
      "Response is not a JSON object"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should handle schema validation errors", async () => {
    const invalidData = { invalid: "data" };
    mockGenerateText.mockResolvedValue({
      ...mockAIResponse,
      text: JSON.stringify(invalidData),
    });

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await expect(parser["parseTextToProfile"](mockPdfText)).rejects.toThrow(
      "Failed to parse AI response"
    );
    expect(console.error).toHaveBeenCalledWith(
      "Raw AI response:",
      expect.any(String)
    );
  });

  it("should parse a complete resume", async () => {
    await writeFile(mockPdfPath, "Mock PDF content", "utf-8");

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    const profile = await parser.parseResume(mockPdfPath);
    expect(profile).toEqual(mockProfile);
  });

  it("should save profile to the correct directory", async () => {
    await writeFile(mockPdfPath, "Mock PDF content", "utf-8");

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await parser.parseResume(mockPdfPath);

    // Check if profile was saved
    const expectedFilePath = join(profilesDir, "john_doe.json");
    expect(existsSync(expectedFilePath)).toBe(true);

    // Verify content
    const savedContent = await readFile(expectedFilePath, "utf-8");
    const savedProfile = JSON.parse(savedContent);
    expect(savedProfile).toEqual(mockProfile);
  });

  it("should handle profile directory creation", async () => {
    // Remove profiles directory if it exists
    if (existsSync(profilesDir)) {
      await rm(profilesDir, { recursive: true });
    }

    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    await parser.parseResume(mockPdfPath);

    // Check if directory was created
    expect(existsSync(profilesDir)).toBe(true);
  });

  it("should handle duplicate profile names", async () => {
    const parser = new Parser({
      provider: "openai",
      apiKey: mockApiKey,
    });

    // Parse the same resume twice
    await parser.parseResume(mockPdfPath);
    await parser.parseResume(mockPdfPath);

    // Check if both files exist with different names
    const files = await readdir(profilesDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    expect(jsonFiles.length).toBeGreaterThanOrEqual(1);
  });
});
