import { z } from "zod";

export const JobListingSchema = z.object({
  title: z
    .string()
    .describe(
      "The job title, like 'Software Engineering Intern' or 'Senior Data Analyst' etc."
    ),
  company: z.string().describe("The company that is posting the job"),
  location: z
    .string()
    .describe("The location of the job, like 'San Francisco, CA'"),
  description: z
    .string()
    .describe(
      "The description of the job. Create a short one if it's not provided."
    ),
  url: z
    .string()
    .describe("The url of the job listing")
    .describe(
      "Put the exact job URL. Not the URL for the job board, but for the exact job post."
    ),
});

export type JobListing = z.infer<typeof JobListingSchema>;
