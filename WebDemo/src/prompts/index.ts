import fs from 'node:fs';
import path from 'node:path';

const SYSTEM_SLIM_PROMPT_PATH = path.join(__dirname, 'system-llm-slim.md');
const USER_PROMPT_PATH = path.join(__dirname, 'user.md');
const SYSTEM_FLAT_PROMPT_PATH = path.join(__dirname, 'system-llm-flat.md');
const SYSTEM_HIER_PROMPT_PATH = path.join(__dirname, 'system-llm-hier.md');

export const USER_PROMPT = fs.readFileSync(USER_PROMPT_PATH, 'utf-8');
export const SYSTEM_SLIM_PROMPT = fs.readFileSync(
  SYSTEM_SLIM_PROMPT_PATH,
  'utf-8',
);
export const SYSTEM_HIER_PROMPT = fs.readFileSync(
  SYSTEM_HIER_PROMPT_PATH,
  'utf-8',
);
export const SYSTEM_FLAT_PROMPT = fs.readFileSync(
  SYSTEM_FLAT_PROMPT_PATH,
  'utf-8',
);
