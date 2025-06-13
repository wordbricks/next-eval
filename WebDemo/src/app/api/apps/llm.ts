import fs from "node:fs/promises";
import path from "node:path";
import type { LLMResponse, PromptType } from "@/app/api/types";
import { GEMINI_PRO_2_5_PREVIEW_03, loadPromptContent } from "@/app/api/utils";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { Hono } from "hono";

const llmApp = new Hono();

llmApp.post("/", async (c) => {
  try {
    const { promptType, data, randomNumber } = (await c.req.json()) as {
      promptType: PromptType;
      data: string;
      randomNumber?: number | null;
    };

    // Check API key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error(
        "API key is not set in .env or not accessible. Please set the GOOGLE_GENERATIVE_AI_API_KEY environment variable.",
      );
      return c.json({ error: "API key not configured" } as LLMResponse, 500);
    }

    // Handle sample data loading
    if (randomNumber !== null && randomNumber !== undefined) {
      try {
        const contentPath = path.join(
          process.cwd(),
          "src",
          "assets",
          `sample${randomNumber}_${promptType}_content.json`,
        );
        const usagePath = path.join(
          process.cwd(),
          "src",
          "assets",
          `sample${randomNumber}_${promptType}_usage.json`,
        );

        const contentFile = await fs.readFile(contentPath, "utf-8");
        const usageFile = await fs.readFile(usagePath, "utf-8");

        const contentData = contentFile; // Assuming content is string, not parsed JSON
        const usageData = JSON.parse(usageFile);

        const responsePayload: LLMResponse = {
          content: contentData,
          usage: usageData,
          systemPromptUsed: `Loaded from local assets (sample${randomNumber})`,
        };
        return c.json(responsePayload);
      } catch (assetError) {
        console.error(
          `Error loading assets for sample${randomNumber}:`,
          assetError,
        );
        return c.json(
          {
            error: `Assets for sample ${randomNumber} not found or are invalid.`,
          } as LLMResponse,
          404,
        );
      }
    }

    // Validate prompt type
    if (!promptType || !["slim", "flat", "hier"].includes(promptType)) {
      return c.json({ error: "Invalid prompt type" } as LLMResponse, 400);
    }

    // Generate text using AI
    const systemPromptContent = await loadPromptContent(promptType);
    const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
    const temperature = 1.0;

    const { text, usage } = await generateText({
      model: google(GEMINI_PRO_2_5_PREVIEW_03),
      prompt: combinedPrompt,
      temperature: temperature,
    });

    const responsePayload: LLMResponse = {
      content: text || "```json[]```",
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      systemPromptUsed: `Loaded from file: system-llm-${promptType}.md`,
    };

    return c.json(responsePayload);
  } catch (error) {
    console.error("Error in /api/llm:", error);

    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.cause) {
        errorMessage += ` - Cause: ${JSON.stringify(error.cause)}`;
      }
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      errorMessage = String(error.message);
    }

    return c.json({ error: errorMessage } as LLMResponse, 500);
  }
});

export default llmApp;
