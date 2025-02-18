export const buildExtractionPrompt = () => {
  return `Extract one job listing from the page`;
};

export const buildEmailAnalysisPrompt = (
  subject: string,
  sender: string,
  content: string
) => {
  return `Subject: ${subject}\nFrom: ${sender}\n\nContent: ${content}`;
}