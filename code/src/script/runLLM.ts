import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
	SYSTEM_SLIM_PROMPT,
	SYSTEM_HIER_PROMPT,
	SYSTEM_FLAT_PROMPT
} from "../prompts";
import { DATA_PATH, xpathArraySchema } from "../constant";
import type { LLMUsage } from "../interfaces";
import { USER_PROMPT } from "../prompts";
import { compile, getLLMResponse, parseAndValidateXPaths } from "../utils";

const MAX_RETRY_ATTEMPTS = 3;

const retryXPathExtraction = async (
	prompt: string,
	maxAttempts: number,
	systemPrompt: string,
	modelName: string = "gemini-2.0-flash-001",
	temperature: number = 1.0,
	seed: number = 12345
): Promise<{ xpaths: z.infer<typeof xpathArraySchema>; usage?: LLMUsage }> => {
	let lastError: Error | null = null;

	for (let currentAttempt = 1; currentAttempt <= maxAttempts; currentAttempt++) {
		try {
			const llmResponse = await getLLMResponse(prompt, systemPrompt, modelName, temperature, seed);
			const validatedXPaths = parseAndValidateXPaths(llmResponse.content);
			return {
				xpaths: validatedXPaths,
				usage: llmResponse.usage
			};
		} catch (error) {
			console.error(`Error occurred ${error}`);
			lastError = error instanceof Error ? error : new Error(String(error));
			if (currentAttempt === maxAttempts) {
				throw lastError;
			}
			console.log(`Attempt ${currentAttempt} failed, retrying...`);
		}
	}
	throw lastError;
};

const processWithLLM = async (
	slugUrl: string,
	inputFileName: string,
	outputFileName: string,
	usageFileName: string,
	systemPrompt: string,
	modelName: string = "gemini-2.0-flash-001",
	temperature: number = 1.0,
	seed: number = 12345
) => {
	const dirPath = path.join(DATA_PATH, slugUrl);
	const textMapPath = path.join(dirPath, inputFileName);
	const outputPath = path.join(dirPath, outputFileName);
	const usagePath = path.join(dirPath, usageFileName);

	try {
		if (!fs.existsSync(textMapPath)) {
			console.log(`No ${textMapPath} found for ${slugUrl}`);
			return;
		}

		const textMap = fs.readFileSync(textMapPath, "utf-8");
		const userPrompt = compile(USER_PROMPT, { input: textMap });

		const { xpaths, usage } = await retryXPathExtraction(userPrompt, MAX_RETRY_ATTEMPTS, systemPrompt, modelName, temperature, seed);

		// Save the XPaths response
		fs.writeFileSync(outputPath, JSON.stringify(xpaths, null, 2));

		// Save the usage data if available
		if (usage) {
			fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
		}

		console.log(`Processed ${slugUrl} (model: ${modelName}).`);
	} catch (err) {
		console.error(`Error processing ${slugUrl} with model ${modelName}:`, err);
	}
};

type Mode = 'slim' | 'hier' | 'flat';

interface RunConfig {
	inputFileName: string;
	outputPrefix: string;
	usagePrefix: string;
	systemPrompt: string;
}

const getConfig = (mode: Mode, seed: number): RunConfig => {
	const configs: Record<Mode, RunConfig> = {
		'slim': {
			inputFileName: "syn.html",
			outputPrefix: `llm_response_slim_${seed}`,
			usagePrefix: `llm_usage_slim_${seed}`,
			systemPrompt: SYSTEM_SLIM_PROMPT,
		},
		'hier': {
			inputFileName: "text_map_hier.json",
			outputPrefix: `llm_response_hier_${seed}`,
			usagePrefix: `llm_usage_hier_${seed}`,
			systemPrompt: SYSTEM_HIER_PROMPT,
		},
		'flat': {
			inputFileName: "text_map_flat.json",
			outputPrefix: `llm_response_flat_${seed}`,
			usagePrefix: `llm_usage_flat_${seed}`,
			systemPrompt: SYSTEM_FLAT_PROMPT,
		}
	};

	return configs[mode];
};

const SEED = 0;
const TEMPERATURE = 1.0;
const MODEL_NAME = "gemini-2.5-pro-preview-03-25";

const runMain = async (mode: Mode) => {
	console.log(`Running ${mode} mode with seed: ${SEED}`);
	const config = getConfig(mode, SEED);
	const inputFileName = config.inputFileName;
	const outputFileName = `${config.outputPrefix}.json`;
	const usageFileName = `${config.usagePrefix}.json`;
	const systemPrompt = config.systemPrompt;
	const allUrls = fs.readdirSync(DATA_PATH);

	for (const url of allUrls) {
		if (url === "results" || url === ".DS_Store") {
			continue;
		}
		console.log(`Processing ${url}`);
		try {
			await processWithLLM(url, inputFileName, outputFileName, usageFileName, systemPrompt, MODEL_NAME, TEMPERATURE, SEED);
		} catch (error) {
			console.error(`Error processing slug ${url} in retry pass:`, error);
		}
	}
};

// Parse command-line arguments
const parseMode = (modeArg: string): Mode => {
	const normalizedMode = modeArg.toLowerCase();
	if (normalizedMode === 'slim' || normalizedMode === 'hier' || normalizedMode === 'flat') {
		return normalizedMode as Mode;
	}
	console.error("Invalid mode. Please use 'slim', 'hier', or 'flat'.");
	process.exit(1);
};

// Get mode from command line arguments (required)
if (!process.argv[2]) {
	console.error("Missing mode argument. Please specify 'slim', 'hier', or 'flat'.");
	process.exit(1);
}

const mode = parseMode(process.argv[2]);

runMain(mode); 
