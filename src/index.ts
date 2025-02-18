// import { GoogleScraper } from "./lib/scraper/google";
// import GreenhouseWorker from "./lib/workers/greenhouse";
import { config } from "dotenv";
import express, { Request, Response } from "express";
import { createServer } from "http";
import multer, { FileFilterCallback } from "multer";
import { join } from "path";
import logger from "@/lib/logger";
import { Parser } from "@/lib/resume/parse";
import { GoogleScraper } from "@/lib/scraper/google";
import { SocketServer } from "@/lib/socket/socket";
import GreenhouseWorker from "@/lib/workers/greenhouse";

config();

const app = express();
const httpServer = createServer(app);
const httpPort = process.env.PORT || 3000;
const wsPort = process.env.WS_PORT || 8080;

// Initialize WebSocket server on a different port
const socketServer = new SocketServer(parseInt(wsPort.toString()));

// Configure multer for file uploads
const upload = multer({
  dest: join(process.cwd(), "bin", "uploads"),
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

type RequestWithFile = Request & { file?: Express.Multer.File };

app.post(
  "/api/parse",
  upload.single("file"),
  async (req: RequestWithFile, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const parser = new Parser({
        provider: "openai",
        model: "gpt-4o",
      });

      const profile = await parser.parseResume(file.path);
      res.json({ profile });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Failed to parse resume" });
    }
  }
);

app.post(
  "/api/apply",
  express.json({
    type: "*/*",
  }),
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: "clientId is required" });
      }

      socketServer.sendToClient(clientId, {
        type: "session_init",
      });

      socketServer.sendToClient(clientId, {
        type: "log",
        message: "Starting job search...",
      });

      const scraper = new GoogleScraper();
      await scraper.init();
      socketServer.sendToClient(clientId, {
        type: "log",
        message: "Getting job listings...",
      });
      const listings = await scraper.getJobListings();

      socketServer.sendToClient(clientId, {
        type: "log",
        message: "Found job listings!",
      });

      await new Promise((resolve) => setTimeout(resolve, 4000));

      for (const listing of listings) {
        socketServer.sendToClient(clientId, {
          type: "job_listing",
          data: {
            company: listing.company,
            jobTitle: listing.title,
            url: listing.url,
            location: listing.location,
            status: "Initializing...",
          },
        });
      }

      const worker = new GreenhouseWorker(socketServer, clientId);
      await worker.init();
      await worker.apply(listings[0]);

      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Failed to apply to job" });
    }
  }
);

// Start HTTP server
httpServer.listen(httpPort, () => {
  logger.info(`HTTP server running on port ${httpPort}`);
  logger.info(`WebSocket server running on port ${wsPort}`);
});
