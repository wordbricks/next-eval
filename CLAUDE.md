# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXT-EVAL is a monorepo for evaluating web data extraction methods, combining traditional algorithms (MDR) with LLM-based approaches. It's an academic/research tool accompanying a NeurIPS 2025 paper.

## Development Commands

### Essential Commands
```bash
# Development
bun run dev                 # Start dev server on port 3839
bun run build              # Build all packages
bun run test               # Run vitest tests
bun run test:run           # Run tests once
bun run lint               # Run Biome linter
bun run format             # Format code with Biome
bun run check-types        # TypeScript type checking

# Package Management
bun install                # Install dependencies (uses Bun, not npm/yarn)
bun run add:component      # Add shadcn UI components

# Prompt Generation (for LLM testing)
cd packages/next-eval && bun run prompts:gen
```

### Testing Single Files
```bash
# Run specific test file
cd apps/web && bun run test path/to/test.spec.ts

# Run tests in watch mode for a specific file
cd apps/web && bun run test --watch path/to/test.spec.ts
```

## Architecture & Key Concepts

### Monorepo Structure
- `/apps/web/` - Next.js 14+ web application (App Router)
- `/packages/next-eval/` - Core library (@wordbricks/next-eval)
- `/packages/ui/` - Shared UI components (@next-eval/ui)
- `/packages/rust-mdr/` - Rust WASM module for MDR algorithm

### Core Processing Pipeline
1. **HTML Processing**: Converts raw HTML into three formats:
   - Slim HTML (cleaned, simplified)
   - Hierarchical JSON (nested structure)
   - Flat JSON (XPath-based key-value pairs)

2. **Extraction Methods**:
   - **LLM Tab**: Uses Google Gemini via structured prompts
   - **MDR Tab**: Traditional Maximum Data Region algorithm (Rust/WASM)

3. **Evaluation**: Hungarian algorithm for optimal record matching, calculating precision/recall/F1

### State Management
- Uses Jotai atoms for global state (see `/apps/web/src/atoms/`)
- Key atoms: `htmlContentAtom`, `llmResultsAtom`, `mdrResultsAtom`

### API & Workers
- API routes in `/apps/web/src/app/api/` using Hono framework
- Web Workers for CPU-intensive tasks (MDR processing)
- WASM module loaded from `/public/rust_mdr_pkg/`

## Environment Setup

Create `.env.local` file in `/apps/web/`:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=optional_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=optional_supabase_key
```

## Code Style & Linting

- Uses Biome (not ESLint/Prettier)
- 2-space indentation
- 80-character line limit
- Run `bun run format` before committing
- Git hooks via lefthook ensure code quality

## Testing Approach

- Vitest for unit/integration tests
- Tests located in `/apps/web/tests/`
- 3-minute timeout for long-running tests
- JSDOM environment for React component testing

## Key Dependencies & Patterns

- **UI**: Tailwind CSS v4, shadcn/ui components
- **State**: Jotai atoms (not Redux/Context)
- **Routing**: Next.js App Router with `/next-eval` base path
- **AI**: Google Generative AI SDK (Gemini)
- **Evaluation**: munkres-js for Hungarian algorithm
- **HTML Parsing**: node-html-parser
- **Build**: Turborepo + Bun workspaces

## Common Tasks

### Adding New LLM Prompts
1. Edit prompt templates in `/packages/next-eval/src/llm/prompts/`
2. Run `cd packages/next-eval && bun run prompts:gen`
3. Prompts are generated via content-collections

### Modifying MDR Algorithm
1. Edit Rust code in `/packages/rust-mdr/src/`
2. Run `cd packages/rust-mdr && bun run build`
3. WASM module auto-copied to `/apps/web/public/rust_mdr_pkg/`

### Working with Sample Data
- Sample HTML files in `/apps/web/public/sample-htmls/`
- Test fixtures in `/apps/web/tests/fixtures/`