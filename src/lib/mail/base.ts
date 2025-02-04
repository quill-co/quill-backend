import logger from '@/lib/logger';
import { LLMType, LLMProvider } from '@/lib/llm';
import { Client, Config, Mail } from '@quill-co/mailstream';

export interface MailWorkerEvents {
  mail: (mail: Mail) => Promise<void>;
  error: (error: Error) => void;
}

export abstract class BaseMailWorker {
  protected client!: Client;
  protected checkInterval: NodeJS.Timeout | null = null;
  private readonly workerId: string;
  protected readonly llmProvider: LLMProvider;

  constructor(
    protected readonly config: Config,
    provider: LLMType,
  ) {
    this.workerId = crypto.randomUUID();
    this.llmProvider = new LLMProvider(provider);
  }

  protected log(message: string): void {
    logger.info(`[Mail:${this.workerId}] ${message}`);
  }

  async init(): Promise<void> {
    this.client = await Client.create(this.config);
    this.log('Mail worker initialized');
    await this.startListening();
  }

  private async startListening(): Promise<void> {
    this.client.on('mail', this.processMail.bind(this));
    await this.client.getUnseenMails();

    this.checkInterval = setInterval(async () => {
      try {
        await this.client.getUnseenMails();
      } catch (error) {
        logger.error(`Error checking mail: ${error}`);
      }
    }, 60000); // Check every minute
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.client) {
      await this.client.close();
    }
    this.log('Mail worker stopped');
  }

  private async processMail(mail: Mail): Promise<void> {
    try {
      await this.handleMail(mail);
    } catch (error) {
      logger.error(`Error processing mail: ${error}`);
    }
  }

  abstract handleMail(mail: Mail): Promise<void>;
}