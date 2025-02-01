import { z } from "zod";

export const JobListingSchema = z.object({
  title: z.string().describe("The title of the job listing"),
  company: z.string().describe("The company that is posting the job"),
  location: z.string().describe("The location of the job"),
  description: z
    .string()
    .describe("The description of the job. Create one if it's not provided."),
  url: z.string().describe("The url of the job listing"),
});

export type JobListing = z.infer<typeof JobListingSchema>;
