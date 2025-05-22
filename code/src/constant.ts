import { dirname, resolve } from "node:path";
import { findUpSync } from "find-up";
import { z } from "zod";

const root = findUpSync("package.json", { cwd: process.cwd() });
export const DATA_PATH = root
	? resolve(dirname(root), "src/data/")
	: "./data";

// MDR (Mining Data Region) constants
export const MDR_K = 10; // Maximum length of a data region pattern
export const MDR_T = 0.3; // Similarity threshold for data region detection

// Schema for validating XPath array structure
export const xpathArraySchema = z.array(z.array(z.string()));