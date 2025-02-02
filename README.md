# Quill Backend

A powerful automated job application system with real-time progress tracking and AI-powered resume parsing.

## Features

### Resume Parsing

- PDF resume parsing with multiple AI model support
  - OpenAI (GPT-4)
  - Anthropic (Claude)
  - Google (Gemini)
  - DeepSeek
- Structured profile extraction including:
  - Personal information
  - Work experience
  - Education
  - Skills
  - Projects
  - Contact details

### Job Application Automation

- Automated form filling for Greenhouse ATS
- Real-time application status updates via WebSocket
- Smart education institution matching
- Automatic resume upload
- Progress tracking for each application step

### Real-time Updates

- WebSocket-based status notifications
- Detailed logging of application progress
- Job listing status tracking
- Error handling and reporting

## Tech Stack

### Backend

- **Node.js** with **TypeScript**
- **Express.js** for API endpoints
- **WebSocket** for real-time communication
- **Browserbase** for running browser automations on the cloud
- **Stagehand** for AI browser automation
- **Puppeteer** for browser automation
- **Multer** for file uploads
- **Zod** for runtime type validation

### AI/ML

- Multiple AI model integrations:
  - OpenAI
  - Anthropic
  - Google AI
  - DeepSeek
- PDF text extraction using Python (pdfminer.six)

### Testing

- Jest for unit testing
- TypeScript for type safety
- ESLint for code quality

### Infrastructure

- Separate HTTP and WebSocket servers
- Environment-based configuration
- Structured logging with Pino

## API Endpoints

### POST /api/parse

Parses a resume PDF and returns structured data.

```typescript
// Request (multipart/form-data)
{
  file: File, // PDF file
  modelId: "openai" | "anthropic" | "google" | "deepseek"
}

// Response
{
  profile: {
    name: string,
    contactInfo: {...},
    experiences: [...],
    education: [...],
    // ...
  }
}
```

### POST /api/apply

Initiates an automated job application process.

```typescript
// Request
{
  clientId: string; // WebSocket client identifier
}

// Response
{
  success: boolean;
}
```

## WebSocket Events

### Client Messages

- `session_init`: Session initialization
- `log`: Application process logs
- `job_listing`: Job listing updates
- `status`: Application status updates

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```env
   PORT=3000
   WS_PORT=8080
   OPENAI_API_KEY=your_key
   ANTHROPIC_API_KEY=your_key
   GOOGLE_API_KEY=your_key
   DEEPSEEK_API_KEY=your_key
   ```

3. Set up Python environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install pdfminer.six
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running in Development

```bash
npm run dev
```

## Project Structure

```
src/
├── lib/
│   ├── resume/     # Resume parsing logic
│   ├── scraper/    # Job listing scrapers
│   ├── socket/     # WebSocket handling
│   └── workers/    # Job application automation
├── types/          # TypeScript type definitions
├── util/          # Utility functions
└── index.ts       # Main application entry
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC License
