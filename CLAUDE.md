# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXT-EVAL is a Turborepo monorepo for evaluating web data record extraction methods, comparing traditional algorithms with LLM-based approaches. The project will be structured as:
- **Core**: Open-source npm library (`@next-eval/core`)
- **Web Demo**: Interactive Next.js playground (`apps/web`)

## Key Commands

### Development
```bash
# Install dependencies (uses Bun)
bun install

# Run the web playground (port 3839)
bun run dev

# Build all packages
bun run build

# Type checking
bun run check-types

# Linting (uses Biome)
bun run lint

# Format code
bun run format
```

### Core Library Scripts
```bash
# Preprocess HTML for LLM extraction
bun run preprocess

# Run LLM extraction
bun run runLLM

# Run MDR (Model-based Data Record) algorithm
bun run mdr

# Evaluate extraction results
bun run evaluate
```

## Architecture

### Monorepo Structure
- **`/apps/web`**: Next.js 15 web application
  - Uses App Router
  - API routes handle LLM interactions and data processing
  - Integrates with Supabase for data storage
  - WASM integration for MDR algorithms (`public/rust_mdr_pkg/`)

- **`/packages/core`**: Core extraction and evaluation library
  - Scripts for preprocessing, running LLM/MDR, and evaluation
  - Supports multiple LLM providers (Google AI, OpenAI, Anthropic)
  - Uses Puppeteer for browser automation

- **`/packages/shared`**: Shared types and utilities
  - Common interfaces (`EvaluationResult`, `LLMResponse`, `TagNode`)
  - HTML processing utilities
  - XPath mapping utilities

- **`/packages/rust-mdr`**: Rust WASM module for MDR algorithms

### Key Technologies
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Hono (API framework), Supabase
- **AI/ML**: Google Generative AI, OpenAI, Anthropic SDKs
- **Build**: Turborepo, Bun, TypeScript
- **Code Quality**: Biome (linting/formatting), Lefthook (git hooks)

### Data Flow
1. **Preprocessing**: HTML → Simplified/Hierarchical/Slim formats
2. **Extraction**: Run MDR algorithms or LLM prompts on processed HTML
3. **Evaluation**: Compare extracted records with ground truth using Hungarian algorithm
4. **Metrics**: Calculate precision, recall, F1 scores at cell and schema levels

### Important Patterns
- All packages use ESM modules (`"type": "module"`)
- Absolute imports from shared package: `@next-eval/shared/interfaces/*`
- Prompts stored in markdown files (`src/prompts/`)
- Sample data in `apps/web/src/assets/` (JSON format)
- HTML samples in `apps/web/public/samples/`