<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="Next-eval-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="Next-eval-light.png">
    <img alt="NEXT-EVAL Logo" src="next-eval-light.png" width="300">
  </picture>
</p>


# NEXT-EVAL: From Web URLs to Structured Tables – Extraction and Evaluation

Welcome to **NEXT-EVAL**, a comprehensive toolkit for the rigorous evaluation and comparison of methods for extracting **tabular data records** from web pages. This framework supports both traditional algorithms and modern Large Language Model (LLM)-based approaches. We provide the necessary components to generate datasets, preprocess web data, evaluate model performance, and conduct standardized benchmarking.

**NEXT-EVAL** is an open-source library accompanying the NeurIPS 2025 paper:

> 📄 **NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction**
> \[https://arxiv.org/abs/2505.17125] 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)
[![Paper](https://img.shields.io/badge/Read%20the%20Paper-blue)](https://arxiv.org/abs/6452467) 


This library provides tools for generating web-to-table datasets, applying extraction techniques (both traditional and LLM-based), and evaluating them with a standardized framework. It is intended to advance benchmarking and reproducibility in web data extraction research.

---

## 🔧 Components

### 1. HTML processing Tool

Convert real-world webpage HTML into a compact format for LLM using the following tools:

* **HTML to Slim HTML**: Clean and simplify raw HTML for model input.
* **HTML to Hierachical Json**: Structure webpage HTML into a nested JSON format which conserves the original structure.
* **HTML to Flat Json**: Structure HTML into a flat JSON format where the key is xpath and the value is the text.

```typescript
import { processHtmlContent } from "@next-eval/html-core/utils/processHtmlContent";

const htmlString = "<!DOCTYPE html>
<html lang="en">
<body>
  <div class="container">
    <h1>Main Page</h1>
    <div class="card">
      <div class="card-title">User Profile</div>
      <div class="card-content">
        <ul>
          <li><strong>Name:</strong> Jane Doe</li>
          <li><strong>Email:</strong> jane@example.com</li>
          <li>
            <strong>Skills:</strong>
            <ul>
              <li>JavaScript</li>
              <li>Python</li>
              <li>HTML & CSS</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
";
const { html: slimmedHtml, textMapFlat, textMap } = await processHtmlContent(htmlString);

console.log("[Slim HTML]", slimmedHtml);
console.log("[Hierachcial JSON]", textMap);
console.log("[Flat JSON]", textMapFlat);
```

### 2. Table Generation Tool

Generate tabular data from web content using:

* **LLM-based Extraction**: Run large language models to extract tabular data from raw or simplified HTML inputs.

```
import { getLLMResponse } from "@next-eval/llm-core/utils/getLLMResponse";

const promptType = "slim" //"flat", "hier";
const data = slimmHtml // textMapFlat, textMap;
const temperature = 1.0;
const { text, usage } = await getLLMResponse(data, promptType, temperature);
```

### 3. Evaluation Framework

TODO

---

## 🏁 Getting Started

This project uses a Turborepo monorepo structure with the following organization:
- `apps/web` - Next.js web playground for interactive demos
- `packages/core` - Core library with extraction and evaluation scripts
- `packages/shared` - Shared utilities and interfaces
- `packages/llm-core` - Shared utilities and interfaces
- `packages/rust-mdr` - Rust WASM module for MDR algorithms

### Installation

```bash
git clone https://github.com/your-org/next-eval.git
cd next-eval
bun install
```

### Development

```bash
# Run the web playground
bun run dev

# Build all packages
bun run build

# Run linting
bun run lint

# Type checking
bun run check-types
```

### Core Library Scripts

```bash
# Preprocess HTML for LLM
bun run preprocess

# Run LLM extraction
bun run runLLM

# Run MDR algorithm
bun run mdr

# Evaluate results
bun run evaluate
```

---

## 🧪 Citation

If you use NEXT-EVAL in your research, please cite:

```bibtex
@inproceedings{next-eval2025,
  title={NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction},
  author={arXiv},
  year={2025}
}
```

---

## 🤝 Contributing

We welcome contributions to improve tool coverage, add datasets, or refine evaluation metrics. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📬 Contact

For questions or collaborations, open an issue or email us at \[[research@wordbricks.ai](mailto:research@wordbricks.ai)].
