import { z } from "zod";

export const ProfileSchema = z.object({
	name: z.string(),
	contactInfo: z.object({
		email: z.string().email(),
		phone: z.string(),
		address: z.object({
			street: z.string(),
			city: z.string(),
			state: z.string(),
			zip: z.string(),
			country: z.string(),
		}),
		linkedin: z.string().url().optional(),
		github: z.string().url().optional(),
		twitter: z.string().url().optional(),
		website: z.string().url().optional(),
	}),
	experiences: z.array(
		z.object({
			company: z.string(),
			position: z.string(),
			startDate: z.string(),
			endDate: z.string().nullable().optional(),
			description: z.string(),
		})
	),
	projects: z.array(
		z.object({
			name: z.string(),
			description: z.string(),
			url: z.string().url().optional(),
		})
	),
	resumeUrl: z.string().url(),
	summary: z.string(),
	skills: z.array(z.string()),
	education: z.array(
		z.object({
			institution: z.string(),
			degree: z.string(),
			startDate: z.string(),
			endDate: z.string().nullable().optional(),
		})
	),
	protectedVeteran: z.boolean(),
	race: z.string(),
	needsSponsorship: z.boolean(),
});

export type Profile = z.infer<typeof ProfileSchema>;
