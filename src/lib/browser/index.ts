import { Page, Stagehand } from "@browserbasehq/stagehand";

export async function createBrowser(): Promise<Page> {
  const stagehand = new Stagehand({
    apiKey: process.env.BROWSERBASE_API_KEY,
    env: process.env.ENVIRONMENT === "development" ? "LOCAL" : "BROWSERBASE",
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      region: "us-east-1",
    },
  });

  await stagehand.init();

  const { page } = stagehand;

  return page;
}
