# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXT-EVAL is a Turborepo monorepo for evaluating web data record extraction methods, comparing traditional algorithms with LLM-based approaches. The project is structured as:
- **Core**: Open-source npm library (`@wordbricks/next-eval`)
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

# Run tests
bun run test

# Add UI components
bun run add:component
```

### Turbo Tasks (run with `turbo run <task>`)
```bash
# Preprocess HTML for LLM extraction
turbo run preprocess

# Run LLM extraction
turbo run runLLM

# Run MDR (Model-based Data Record) algorithm
turbo run mdr

# Evaluate extraction results
turbo run evaluate

# Run benchmark tests
turbo run test:bench
```

## Architecture

### Monorepo Structure
- **`/apps/web`**: Next.js web application
  - Uses App Router
  - API routes handle LLM interactions and data processing
  - Integrates with Supabase for data storage
  - WASM integration for MDR algorithms (`public/rust_mdr_pkg/`)
  - Test suite with Vitest (`tests/`)

- **`/packages/next-eval`**: Core extraction and evaluation library
  - Main package name: `@wordbricks/next-eval`
  - Contains shared interfaces and utilities in `src/shared/`
  - Supports multiple LLM providers (Google AI, OpenAI, Anthropic)
  - MDR algorithm implementations

- **`/packages/ui`**: UI component library
  - Reusable React components
  - Custom hooks
  - Based on shadcn/ui

- **`/packages/rust-mdr`**: Rust WASM module for MDR algorithms

- **`/packages/tsconfig`**: Shared TypeScript configurations

### Key Technologies
- **Frontend**: Next.js (latest), React 19.1.0, Tailwind CSS v4
- **State Management**: Jotai (atomic state management)
- **Backend**: Hono (API framework), Supabase
- **AI/ML**: Google Generative AI, ai SDK (@ai-sdk/google)
- **Build**: Turborepo, Bun, TypeScript
- **Testing**: Vitest
- **Code Quality**: Biome (linting/formatting), Lefthook (git hooks)

### Data Flow
1. **Preprocessing**: HTML → Simplified/Hierarchical/Slim formats
2. **Extraction**: Run MDR algorithms or LLM prompts on processed HTML
3. **Evaluation**: Compare extracted records with ground truth using Hungarian algorithm
4. **Metrics**: Calculate precision, recall, F1 scores at cell and schema levels

### Important Patterns
- All packages use ESM modules (`"type": "module"`)
- Import patterns:
  - Core functionality: `@wordbricks/next-eval/*`
  - UI components: `@next-eval/ui`
  - TypeScript configs: `@next-eval/tsconfig`
- Prompts stored in markdown files (`src/prompts/`)
- Sample data in `apps/web/src/assets/` (JSON format)
- HTML samples in `apps/web/public/samples/`
- MDR state management with Jotai atoms (`apps/web/src/atoms/mdr.ts`)
- Expected MDR outputs for testing in `apps/web/tests/expectedMdrOutputs/`