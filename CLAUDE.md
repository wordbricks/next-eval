# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXT-EVAL is a comprehensive toolkit for evaluating methods for extracting tabular data records from web pages. It supports both traditional algorithms (MDR) and LLM-based approaches, with a web demo built on Next.js and command-line scripts for batch processing.

## Common Development Commands

### WebDemo (Next.js Application)
```bash
# Navigate to WebDemo directory
cd WebDemo

# Install dependencies
npm install

# Run development server (port 3839)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint and format code
npm run lint
```

### Code Scripts (Bun-based Processing)
```bash
# Navigate to code directory
cd code

# Preprocess HTML files to different formats
bun run preprocess

# Run LLM extraction (requires mode and group arguments)
bun run runLLM <mode> <group>
# mode: 'slim', 'hier', or 'flat'
# group: 1-5 (for parallel processing)

# Run MDR algorithm
bun run mdr

# Evaluate extraction results
bun run evaluate
```

## High-Level Architecture

### 1. Data Processing Pipeline
- **Input**: MHTML files containing web pages with tabular data
- **Processing Stages**:
  1. **Slim HTML**: Cleaned HTML with scripts/styles/comments removed
  2. **Hierarchical JSON**: Nested structure preserving DOM hierarchy
  3. **Flat JSON**: XPath-to-text mapping for easy lookup

### 2. Extraction Methods
- **LLM-based**: Uses Gemini 2.5 Pro to extract XPaths of data records
  - Three prompts: slim (HTML), hier (hierarchical JSON), flat (flat JSON)
  - Includes retry logic and validation
- **MDR Algorithm**: Traditional approach finding repeating patterns in DOM
  - Parameters: K (max generalized node size), T (similarity threshold)

### 3. Evaluation System
- Uses Hungarian algorithm (munkres) for optimal record matching
- Calculates precision, recall, F1 scores
- Tracks hallucination rate for LLM methods

### 4. Web Demo Architecture
- **Frontend**: React with TypeScript, Tailwind CSS
- **API Routes**:
  - `/api/llm`: Processes data with LLM
  - `/api/save-html`: Stores HTML for feedback
  - `/api/feedback`: Collects user feedback
- **State Management**: React hooks for file processing, LLM responses, MDR results
- **Real-time Evaluation**: Automatic metrics calculation after extraction

### 5. Key Utilities
- `buildTagTree`: Converts HTML DOM to internal tree structure
- `mapResponseToFullXPath`: Maps shortened XPaths to full paths
- `parseAndValidateXPaths`: Validates LLM output format
- `calculateEvaluationMetrics`: Computes extraction performance

## Important Implementation Details

- The WebDemo uses Biome for linting/formatting (configured in biome.json)
- LLM responses are validated against a strict XPath array schema
- The system supports parallel processing of large datasets (164 synthetic examples)
- Evaluation includes handling of "hallucinated" records (XPaths not mapping to any text)
- The MDR algorithm includes post-processing for adjacent region merging and orphan record detection