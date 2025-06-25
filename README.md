<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="Next-eval-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="Next-eval-light.png">
    <img alt="NEXT-EVAL Logo" src="next-eval-light.png" width="350">
  </picture>
</p>

# NEXT-EVAL: From Web URLs to Structured Tables – Extraction and Evaluation

Welcome to **NEXT-EVAL**, a comprehensive toolkit for the rigorous evaluation and comparison of methods for extracting **tabular data records** from web pages. This framework supports both traditional algorithms and modern Large Language Model (LLM)-based approaches. We provide the necessary components to generate datasets, preprocess web data, evaluate model performance, and conduct standardized benchmarking.

**NEXT-EVAL** is an open-source library accompanying the NeurIPS 2025 paper:

> 📄 **NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction** [\[https://arxiv.org/abs/2505.17125\]](https://arxiv.org/abs/2505.17125)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)
[![Paper](https://img.shields.io/badge/Read%20the%20Paper-blue)](https://arxiv.org/abs/2505.17125) 

This library provides tools for generating web-to-table datasets, applying extraction techniques (both traditional and LLM-based), and evaluating them with a standardized framework. It is intended to advance benchmarking and reproducibility in web data extraction research.

## 🌐 Try the Web Demo

Experience NEXT-EVAL in action! Try our interactive web demo where you can upload HTML files or fetch live URLs to preprocess HTML in three different ways (Slim HTML, Hierarchical JSON, and Flat JSON) and compare traditional algorithms with LLM-based extraction methods:

**[Launch Web Demo](https://nextrows.com/next-eval)**

## 📺 Video Explanation

Watch our comprehensive video explanation to understand how NEXT-EVAL works and see it in action:

**[NEXT-EVAL Video Tutorial](https://www.youtube.com/watch?v=1TIeY08pX4I)**

---

## 🏁 Getting Started

```bash
npm install @wordbricks/next-eval
```

---

## 🔧 Components

### 1. HTML Processing Tool

Convert real-world webpage HTML into compact formats optimized for LLM processing:

* **HTML to Slim HTML**: Clean and simplify raw HTML for model input
* **HTML to Hierarchical JSON**: Structure webpage HTML into nested JSON preserving original structure
* **HTML to Flat JSON**: Structure HTML into flat JSON format where key is xpath and value is text

```typescript
import { processHtmlContent } from "@wordbricks/next-eval/html/utils/processHtmlContent";

const htmlString = `<!DOCTYPE html>
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
</html>`;

const { html: slimmedHtml, textMapFlat, textMap } = await processHtmlContent(htmlString);

console.log("[Slim HTML]", slimmedHtml);
console.log("[Hierarchical JSON]", textMap);
console.log("[Flat JSON]", textMapFlat);
```

### 2. Table Generation Tool

Generate tabular data from web content using LLM-based extraction with customizable prompts:

```typescript
import { getLLMResponse } from "@wordbricks/next-eval/llm/utils/getLLMResponse";

const temperature = 1.0; // Control randomness (0.0 to 2.0)

// Option 1: Using Slim HTML format
const { text: slimText, usage: slimUsage } = await getLLMResponse(slimmedHtml, "slim", temperature);

// Option 2: Using Hierarchical JSON format
const { text: hierText, usage: hierUsage } = await getLLMResponse(textMap, "hier", temperature);

// Option 3: Using Flat JSON format  
const { text: flatText, usage: flatUsage } = await getLLMResponse(textMapFlat, "flat", temperature);

console.log("Slim HTML result:", slimText);
console.log("Hierarchical JSON result:", hierText);
console.log("Flat JSON result:", flatText);
```

### 3. Evaluation Framework

Comprehensive evaluation with precision, recall, F1-score, and detailed overlap analysis:

```typescript
import { calculateEvaluationMetrics } from "@wordbricks/next-eval/evaluation/utils/calculateEvaluationMetrics";

const predictedRecords = [
  [
    "/body/section[1]/div[4]/span[1]",
    "/body/section[1]/div[4]/span[2]",
    "/body/section[1]/div[4]/a[1]",
  ],
  [
    "/body/section[1]/div[2]/span[1]",
    "/body/section[1]/div[2]/span[2]",
    "/body/section[1]/div[2]/a[1]",
  ],
  [
    "/body/section[1]/div[3]/span[1]",
    "/body/section[1]/div[3]/span[2]",
    "/body/section[1]/div[3]/a[1]",
  ],
];

const groundTruthRecords = [
  [
    "/body/section[1]/div[3]/span[1]",
    "/body/section[1]/div[3]/a[1]",
    "/body/section[1]/div[3]/button[1]",
  ],
  [
    "/body/section[1]/div[2]/span[1]",
    "/body/section[1]/div[2]/a[1]",
    "/body/section[1]/div[2]/span[3]",
  ],
  [
    "/body/section[1]/div[5]/span[1]",
    "/body/section[1]/div[5]/span[2]",
    "/body/section[1]/div[5]/a[1]",
  ],
];

const { precision, recall, f1, totalOverlap, matches } = calculateEvaluationMetrics(
  predictedRecords, 
  groundTruthRecords
);

console.log(`Precision: ${precision.toFixed(3)}`);
console.log(`Recall: ${recall.toFixed(3)}`);
console.log(`F1-Score: ${f1.toFixed(3)}`);
console.log(`Total Overlap: ${totalOverlap}`);
console.log(`Matches: ${matches}`);
```

---

## 🧪 Citation

If you use NEXT-EVAL in your research, please cite:

```bibtex
@inproceedings{next-eval2025,
  title={NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction},
  author={arXiv},
  year={2025},
  url={https://arxiv.org/abs/2505.17125}
}
```

---

## 🤝 Contributing

We welcome contributions to improve tool coverage, add datasets, or refine evaluation metrics. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📬 Contact

Have questions or ideas? We'd love to hear from you. Contact us at [research@wordbricks.ai](mailto:research@wordbricks.ai)

Inspired by our research? We are looking for innovative thinkers to join our team. Please email your resume to [hr@wordbricks.ai](mailto:hr@wordbricks.ai) and be sure to mention our paper.

To see what else we're building, explore our latest technologies at [nextrows.com](https://nextrows.com)
