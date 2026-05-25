import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environmental context variables
dotenv.config();

// Recreate __dirname cleanly for native ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Company {
  id: number;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  lastCareersHash?: string;
  lastLinkedInHash?: string;
  lastChecked?: string;
}

export interface ScrapeResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export const CONFIG = {
  DATA_FILE_PATH: path.join(__dirname, "../data.json"),
  LINKEDIN_COOKIE: process.env.LINKEDIN_LI_AT || "",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
  CAREERS_PATH: "/careers",
  LINKEDIN_POSTS_PATH: "posts/",
  LINKEDIN_JOBS_PATH: "jobs/",
  CAREERS_CONCURRENCY: 5,
  PACING_MIN_MS: 3000,
  PACING_MAX_MS: 9000,
};

if (!CONFIG.LINKEDIN_COOKIE) {
  console.warn(
    "CRITICAL WARNING: LINKEDIN_LI_AT is not initialized inside your .env file.",
  );
}

if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
  console.warn(
    "WARNING: Telegram notifications are disabled until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in .env.",
  );
}
