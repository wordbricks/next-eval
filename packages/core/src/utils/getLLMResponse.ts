import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import dotenv from "dotenv";

import type { LLMResponse } from "@next-eval/shared/interfaces/LLMResponse";
dotenv.config();

const getGeminiResponse = async (
  userPrompt: string,
  systemPrompt: string,
  modelName = "gemini-2.0-flash-001",
  temperature = 1.0,
  seed = 12345,
): Promise<LLMResponse> => {
  try {
    // Combine system and user prompts as Gemini doesn't have a system message concept
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Using the AI SDK to generate text
    const { text, usage } = await generateText({
      model: google(modelName),
      prompt: combinedPrompt,
      temperature,
      seed,
    });

    if (!text) {
      throw new Error("No response from Gemini");
    }

    return {
      content: text,
      role: "assistant",
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error getting Gemini response:", error);
    throw error;
  }
};

const getOpenAIResponse = async (
  userPrompt: string,
  systemPrompt: string,
  modelName = "gpt-4o",
  temperature = 1.0,
  seed = 12345,
): Promise<LLMResponse> => {
  try {
    const { text, usage } = await generateText({
      model: openai(modelName),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      seed,
    });

    if (!text) {
      throw new Error("No response from OpenAI");
    }

    return {
      content: text,
      role: "assistant",
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error getting OpenAI response:", error);
    throw error;
  }
};

const getClaudeResponse = async (
  userPrompt: string,
  systemPrompt: string,
  modelName = "claude-3-sonnet-20240229",
  temperature = 1.0,
  seed = 12345,
): Promise<LLMResponse> => {
  try {
    const result = await generateText({
      model: anthropic(modelName),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      seed,
    });

    return {
      content: result.text,
      role: "assistant",
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error getting Claude response:", error);
    throw error;
  }
};

export const getLLMResponse = async (
  userPrompt: string,
  systemPrompt: string,
  modelName = "gemini-2.0-flash-001",
  temperature = 1.0,
  seed = 12345,
): Promise<LLMResponse> => {
  // Determine provider based on model name
  const isOpenAI = modelName.toLowerCase().includes("gpt");
  const isClaude = modelName.toLowerCase().includes("claude");

  if (isClaude) {
    return getClaudeResponse(
      userPrompt,
      systemPrompt,
      modelName,
      temperature,
      seed,
    );
  } else if (isOpenAI) {
    return getOpenAIResponse(
      userPrompt,
      systemPrompt,
      modelName,
      temperature,
      seed,
    );
  } else {
    return getGeminiResponse(
      userPrompt,
      systemPrompt,
      modelName,
      temperature,
      seed,
    );
  }
};
