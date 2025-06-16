import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";

import { SYN_DATA_PATH, type xpathArraySchema } from "@next-eval/core/constant";
import {
  SYSTEM_FLAT_PROMPT,
  SYSTEM_HIER_PROMPT,
  SYSTEM_SLIM_PROMPT,
  USER_PROMPT,
} from "@next-eval/core/prompts";
import { getLLMResponse } from "@next-eval/core/utils/getLLMResponse";
import { parseAndValidateXPaths } from "@next-eval/core/utils/parseAndValidate";
import type { LLMUsage } from "@next-eval/shared/interfaces/LLMResponse";
import { compile } from "@next-eval/shared/utils/compile";

const MAX_RETRY_ATTEMPTS = 3;
const NUM_GROUPS = 5;

const retryXPathExtraction = async (
  prompt: string,
  maxAttempts: number,
  systemPrompt: string,
  modelName = "gemini-2.0-flash-001",
  temperature = 1.0,
  seed = 12345,
): Promise<{ xpaths: z.infer<typeof xpathArraySchema>; usage?: LLMUsage }> => {
  let lastError: Error | null = null;

  for (
    let currentAttempt = 1;
    currentAttempt <= maxAttempts;
    currentAttempt++
  ) {
    try {
      const llmResponse = await getLLMResponse(
        prompt,
        systemPrompt,
        modelName,
        temperature,
        seed,
      );
      const validatedXPaths = parseAndValidateXPaths(llmResponse.content);
      return {
        xpaths: validatedXPaths,
        usage: llmResponse.usage,
      };
    } catch (error) {
      console.error(
        `Error during XPath extraction (attempt ${currentAttempt}/${maxAttempts}):`,
        error,
      );
      lastError = error instanceof Error ? error : new Error(String(error));
      if (currentAttempt === maxAttempts) {
        console.error(`XPath extraction failed after ${maxAttempts} attempts.`);
        throw lastError;
      }
      console.log(
        `Retrying XPath extraction (attempt ${currentAttempt + 1}/${maxAttempts})...`,
      );
    }
  }
  // This line should ideally not be reached if maxAttempts > 0, but TypeScript needs a return/throw.
  // If maxAttempts is 0 or negative, lastError could be null.
  throw (
    lastError ??
    new Error(
      "XPath extraction failed due to an unknown error with retry logic.",
    )
  );
};

const processWithLLM = async (
  textMapPath: string, // Full path to the input file
  outputPath: string, // Full path for the output JSON file
  usagePath: string, // Full path for the usage JSON file
  systemPrompt: string,
  modelName = "gemini-2.0-flash-001",
  temperature = 1.0,
  seed = 12345,
) => {
  const displayName = path.basename(textMapPath);
  if (fs.existsSync(outputPath)) {
    console.log(
      `Skipping ${displayName} because its output ${outputPath} already exists`,
    );
    return;
  }

  try {
    if (!fs.existsSync(textMapPath)) {
      console.log(`Input file ${textMapPath} not found.`);
      return;
    }

    const textMap = fs.readFileSync(textMapPath, "utf-8");
    const userPrompt = compile(USER_PROMPT, { input: textMap });

    const { xpaths, usage } = await retryXPathExtraction(
      userPrompt,
      MAX_RETRY_ATTEMPTS,
      systemPrompt,
      modelName,
      temperature,
      seed,
    );

    const outputDirPath = path.dirname(outputPath);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(xpaths, null, 2));

    if (usage) {
      const usageDirPath = path.dirname(usagePath);
      if (!fs.existsSync(usageDirPath)) {
        fs.mkdirSync(usageDirPath, { recursive: true });
      }
      fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
    }

    console.log(
      `Processed ${displayName} (model: ${modelName}). Output: ${outputPath}`,
    );
  } catch (err) {
    console.error(
      `Error processing ${displayName} with model ${modelName}:`,
      err,
    );
    // Optionally re-throw or handle more gracefully if this function is part of a larger batch
  }
};

type Mode = "slim" | "hier" | "flat";

const getPrompt = (mode: Mode): string => {
  const configs: Record<Mode, string> = {
    slim: SYSTEM_SLIM_PROMPT,
    hier: SYSTEM_HIER_PROMPT,
    flat: SYSTEM_FLAT_PROMPT,
  };
  return configs[mode];
};

const SEED = 0;
const TEMPERATURE = 1.0;
const MODEL_NAME = "gemini-2.5-pro-preview-03-25";
const PREFIX = "0522";
//const MODEL_NAME = "gemini-2.5-pro-preview-05-06";
//const MODEL_NAME = "gemini-2.5-pro";

const processedIndicesPath = path.join(SYN_DATA_PATH, "processed_indices.json");
const processedIndices: string[] = JSON.parse(
  fs.readFileSync(processedIndicesPath, "utf-8"),
);

const runMain = async (mode: Mode, groupNumber: number) => {
  console.log(
    `Running ${mode} mode with seed: ${SEED}, group: ${groupNumber}/${NUM_GROUPS}`,
  );
  const systemPrompt = getPrompt(mode);
  const modeSpecificInputPath = path.join(SYN_DATA_PATH, mode);
  const modeSpecificOutputPath = path.join(SYN_DATA_PATH, `${mode}LLM`);

  if (!fs.existsSync(modeSpecificOutputPath)) {
    fs.mkdirSync(modeSpecificOutputPath, { recursive: true });
    console.log(`Created output directory: ${modeSpecificOutputPath}`);
  }

  for (let index = groupNumber - 1; index <= 164; index += NUM_GROUPS) {
    if (!processedIndices.includes(index.toString())) {
      continue;
    }
    const currentInputFilePath = path.join(
      modeSpecificInputPath,
      mode === "slim" ? `${index}.html` : `${index}.json`,
    );
    const currentOutputJsonPath = path.join(
      modeSpecificOutputPath,
      `${index}_${PREFIX}_${SEED}.json`,
    );
    const currentOutputUsagePath = path.join(
      modeSpecificOutputPath,
      `${index}_${PREFIX}_${SEED}_usage.json`,
    );

    console.log(`Preparing to process ${currentInputFilePath}`);
    try {
      await processWithLLM(
        currentInputFilePath,
        currentOutputJsonPath,
        currentOutputUsagePath,
        systemPrompt,
        MODEL_NAME,
        TEMPERATURE,
        SEED,
      );
    } catch (error) {
      // Errors from processWithLLM are logged there. This catch is for errors during the call setup or re-thrown.
      console.error(
        `Unhandled error in runMain loop for file ${currentInputFilePath}:`,
        error,
      );
    }
  }
  console.log(
    `Finished processing all targeted files for ${mode} mode, group ${groupNumber}.`,
  );
};

// Parse command-line arguments
const parseMode = (modeArg: string): Mode => {
  const normalizedMode = modeArg.toLowerCase();
  if (
    normalizedMode === "slim" ||
    normalizedMode === "hier" ||
    normalizedMode === "flat"
  ) {
    return normalizedMode as Mode;
  }
  console.error("Invalid mode. Please use 'slim', 'hier', or 'flat'.");
  process.exit(1);
};

// Get mode from command line arguments (required)
if (!process.argv[2]) {
  console.error(
    "Missing mode argument. Please specify 'slim', 'hier', or 'flat'.",
  );
  process.exit(1);
}

const mode = parseMode(process.argv[2]);

// Get group number from command line arguments (required)
if (!process.argv[3]) {
  console.error(
    `Missing group number argument. Please specify a number between 1 and ${NUM_GROUPS}.`,
  );
  process.exit(1);
}

const parseGroup = (groupArg: string): number => {
  const group = Number.parseInt(groupArg, 10);
  if (Number.isNaN(group) || group < 1 || group > NUM_GROUPS) {
    console.error(
      `Invalid group number. Please use a number between 1 and ${NUM_GROUPS}.`,
    );
    process.exit(1);
  }
  return group;
};

const group = parseGroup(process.argv[3]);

runMain(mode, group);
