import { Config, Mail } from '@quill-co/mailstream';
import { BaseMailWorker } from './base';
import { hosts } from './hosts';
import { LLMType } from '@/lib/llm';

export enum MailboxProvider {
  Gmail = 'gmail',
  Outlook = 'outlook',
  Yahoo = 'yahoo',
}

export interface MailConfig {
  email: string;
  password: string;
  provider: MailboxProvider;
}

export class MailWorker extends BaseMailWorker {
  constructor(
    provider: LLMType,
    emailProvider: MailboxProvider = MailboxProvider.Gmail,
  ) {
    const config: Config = {
      host: hosts[emailProvider],
      port: 993,
      email: process.env.email!,
      password: process.env.password!,
    };
    super(config, provider);
  }

  async handleMail(mail: Mail): Promise<void> {
    this.log(`Processing email from ${mail.from[0].address}`);

    const content = mail.plain?.toString() || '';
    const subject = mail.subject || '';
    const sender = mail.from[0].address || '';

    const response = await this.llmProvider.analyzeEmail(
      content,
      subject,
      sender,
    );

    if (response) {
      // todo: update application status in database
      this.log(`Updated application status: ${JSON.stringify(response)}`);
    }
  }
}