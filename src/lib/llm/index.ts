import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText, LanguageModel, StepResult, tool } from 'ai';
import { z } from 'zod';
import { buildEmailAnalysisPrompt } from '@/lib/prompts';
import logger from '@/lib/logger';

export enum LLMType {
  GPT4o = 'gpt4o',
  Claude35Latest = 'claude35-latest',
  MistralLargeLatest = 'mistral-large-latest',
}

export interface LLMConfig {
  provider: LLMType;
  temperature?: number;
  maxTokens?: number;
}

export interface EmailAnalysisResult {
  company: string;
  title: string;
  status: 'pending' | 'interview' | 'rejected' | 'offer';
  location: string;
  date: Date;
  emailId: string;
}

const models: Record<LLMType, LanguageModel> = {
  [LLMType.GPT4o]: openai('gpt-4o'),
  [LLMType.Claude35Latest]: anthropic('claude-3-5-sonnet-latest'),
  [LLMType.MistralLargeLatest]: openai('mistral-large-latest'),
};

export class LLMProvider {
  private model: LanguageModel;

  constructor(model: LLMType) {
    if (!models[model]) {
      throw new Error(`Unsupported model type: ${model}`);
    }
    this.model = models[model];
  }

  /**
   * Analyzes an email to determine job application status
   * @param content - Email body content
   * @param subject - Email subject
   * @param sender - Email sender address
   * @returns EmailAnalysisResult if status update is needed, null otherwise
   */
  async analyzeEmail(
    content: string,
    subject: string,
    sender: string,
  ): Promise<EmailAnalysisResult | null> {
    const response = await generateText({
      model: this.model,
      system: 'You are an AI that analyzes job application emails and updates application statuses.',
      prompt: buildEmailAnalysisPrompt(subject, sender, content),
      tools: {
        updateApplicationStatus: tool({
          description: 'Update the job application status in the database',
          parameters: z.object({
            company: z.string(),
            title: z.string(),
            status: z.enum(['pending', 'interview', 'rejected', 'offer']),
            location: z.string(),
          }),
          execute: async ({ company, title, status }) => {
            logger.info(
                `Updating application status for ${company} - ${title} to ${status}`,
            );
          },
        }),
      },
      maxSteps: 1,
    });

    const toolCalls = response.steps.flatMap((step: StepResult<any>) => step.toolCalls);
    const toolCall = toolCalls[0];

    if (toolCall?.toolName === 'updateApplicationStatus') {
      return {
        ...toolCall.args,
        date: new Date(),
        emailId: crypto.randomUUID(),
      };
    }

    return null;
  }
}