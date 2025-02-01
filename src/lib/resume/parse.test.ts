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

const mockGenerateText = jest.mocked(generateText);

describe("Resume Parser", () => {
	const mockApiKey = "test-api-key";
	const mockPdfPath = join(process.cwd(), "test-resume.pdf");
	const mockMarkdown = `
# John Doe
Software Engineer

## Contact Information
- Email: john.doe@example.com
- Phone: (123) 456-7890
- Address: 123 Main St, San Francisco, CA 94105, USA
- LinkedIn: https://linkedin.com/in/johndoe
- GitHub: https://github.com/johndoe

## Summary
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
			linkedin: "https://linkedin.com/in/johndoe",
			github: "https://github.com/johndoe",
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

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock successful AI response
		mockGenerateText.mockResolvedValue(mockAIResponse);

		// Mock successful Python execution
		const { exec } = require("child_process");
		const mockExec = exec as jest.MockedFunction<typeof exec>;
		mockExec.mockImplementation(
			(
				command: string,
				callback: (
					error: ExecException | null,
					result: { stdout: string }
				) => void
			) => {
				if (command.includes("--version")) {
					callback(null, { stdout: "Python 3.9.0" });
				} else if (command.includes("pip")) {
					callback(null, { stdout: "pip 21.0.1" });
				} else if (command.includes("python")) {
					callback(null, { stdout: mockMarkdown });
				}
			}
		);
	});

	afterEach(async () => {
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

	it("should convert PDF to markdown", async () => {
		await writeFile(mockPdfPath, "Mock PDF content", "utf-8");

		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		const markdown = await parser["convertPdfToMarkdown"](mockPdfPath);
		expect(markdown).toBe(mockMarkdown.trim());
	});

	it("should handle Python dependency errors", async () => {
		const { exec } = require("child_process");
		const mockExec = exec as jest.MockedFunction<typeof exec>;
		mockExec.mockImplementation(
			(
				_cmd: string,
				callback: (
					error: ExecException | null,
					result: { stdout: string }
				) => void
			) => {
				callback(new Error("Python not found") as ExecException, {
					stdout: "",
				});
			}
		);

		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		await expect(parser["convertPdfToMarkdown"](mockPdfPath)).rejects.toThrow(
			"Failed to convert PDF to markdown"
		);
	});

	it("should parse markdown to profile", async () => {
		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		const profile = await parser["parseMarkdownToProfile"](mockMarkdown);
		expect(profile).toEqual(mockProfile);
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				temperature: 0,
				system: expect.any(String),
				prompt: expect.stringContaining("Parse the following resume markdown"),
			})
		);
	});

	it("should handle AI errors gracefully", async () => {
		mockGenerateText.mockRejectedValue(new Error("AI service error"));

		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		await expect(
			parser["parseMarkdownToProfile"](mockMarkdown)
		).rejects.toThrow("Failed to parse AI response");
	});

	it("should handle invalid JSON responses", async () => {
		mockGenerateText.mockResolvedValue({
			...mockAIResponse,
			text: "not a json",
		});

		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		await expect(
			parser["parseMarkdownToProfile"](mockMarkdown)
		).rejects.toThrow("Failed to parse AI response");
	});

	it("should handle schema validation errors", async () => {
		mockGenerateText.mockResolvedValue({
			...mockAIResponse,
			text: JSON.stringify({ invalid: "data" }),
		});

		const parser = new Parser({
			provider: "openai",
			apiKey: mockApiKey,
		});

		await expect(
			parser["parseMarkdownToProfile"](mockMarkdown)
		).rejects.toThrow("Failed to parse AI response");
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
