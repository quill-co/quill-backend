import { MailboxProvider } from "./index";

export const hosts: Record<MailboxProvider, string> = {
  [MailboxProvider.Gmail]: "imap.gmail.com",
  [MailboxProvider.Outlook]: "outlook.office365.com",
  [MailboxProvider.Yahoo]: "imap.mail.yahoo.com",
} as const;
