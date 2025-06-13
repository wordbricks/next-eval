import dotenv from "dotenv";
import { Hono } from "hono";
import { handle } from "hono/vercel";

// Import individual app modules
import feedbackApp from "@/app/api/apps/feedback";
import llmApp from "@/app/api/apps/llm";
import saveHtmlApp from "@/app/api/apps/save-html";

// Ensure environment variables are loaded
dotenv.config();

// Create main app with base path
const app = new Hono().basePath("/api");

// Mount individual apps to their respective routes
app.route("/feedback", feedbackApp);
app.route("/save-html", saveHtmlApp);
app.route("/llm", llmApp);

// Export handlers for Vercel
export const GET = handle(app);
export const POST = handle(app);
