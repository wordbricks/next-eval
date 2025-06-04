import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import dotenv from 'dotenv';

// Import individual app modules
import feedbackApp from '../apps/feedback';
import saveHtmlApp from '../apps/save-html';
import llmApp from '../apps/llm';

// Ensure environment variables are loaded
dotenv.config();

// Create main app with base path
const app = new Hono().basePath('/api');

// Mount individual apps to their respective routes
app.route('/feedback', feedbackApp);
app.route('/save-html', saveHtmlApp);
app.route('/llm', llmApp);

// Export handlers for Vercel
export const GET = handle(app);
export const POST = handle(app);