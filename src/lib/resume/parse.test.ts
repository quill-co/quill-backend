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
import { writeFile, unlink } from "fs/promises";
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

describe("Resume Parser", () => {
  const mockApiKey = "test-api-key";
  const mockPdfPath = join(process.cwd(), "test-resume.pdf");
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

  const mockGenerateText = jest.mocked(generateText);
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    mockGenerateText.mockResolvedValue(mockAIResponse);

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
    } catch (error) {
      // Ignore if file doesn't exist
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
});
