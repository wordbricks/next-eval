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
> Authors: \[Names to be added]
> \[Paper Link (to be added)]


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)
[![Paper](https://img.shields.io/badge/Read%20the%20Paper-blue)](https://arxiv.org/abs/6452467) 


This library provides tools for generating web-to-table datasets, applying extraction techniques (both traditional and LLM-based), and evaluating them with a standardized framework. It is intended to advance benchmarking and reproducibility in web data extraction research.

---

## 🔧 Components

### 1. Dataset Generation Tool

Convert real-world webpages into structured datasets using the following tools:

* **MHTML Downloader**: Save complete webpages as `.mhtml` archives.
* **HTML to Slim HTML**: Clean and simplify raw HTML for readability and model input.
* **HTML to JSON Converter**: Annotate and structure webpage content into a consistent JSON format for table extraction and supervision.

### 2. Table Generation Tool

Generate tabular data from web content using:

* **Traditional MDR Algorithms**: Integrate existing Model-based Data Record (MDR) extractors to produce tables from HTML.
* **LLM-based Extraction**: Run large language models to extract tabular data from raw or simplified HTML inputs.

### 3. Evaluation Framework

Measure and compare the performance of different extraction methods:

* **Scoring Engine**: Compute precision, recall, and F1 scores on both cell-level and schema-level.
* **Evaluation Scripts**: Ready-to-run scripts to benchmark traditional and LLM extractors on your dataset.

### 4. Data

Get started with:

* ✅ **Sample MHTML Files**: A curated set of real-world webpages.
* ✅ **Sample Annotations**: Human-verified ground truth tables in JSON.

### 5. Benchmark Suite

Includes standardized datasets and evaluation results for:

* Traditional MDR algorithms
* LLM-based extractors (e.g., gemini-2.5-preview)
* Hybrid pipelines

This enables reproducible comparisons across techniques and tasks, such as:

* Web product listings
* Event calendars
* Job listings, etc.

---

## 🏁 Getting Started

```bash
git clone https://github.com/your-org/next-eval.git
cd next-eval
pip install -r requirements.txt
```

### Run the Full Pipeline

```bash
# Download and convert webpage to MHTML
python tools/download_mhtml.py --url https://example.com --output example.mhtml

# Convert MHTML to slim HTML and JSON
python tools/convert_html.py --input example.mhtml --format slim
python tools/convert_html.py --input example.slim.html --format json

# Generate table using LLM
python generate_table_llm.py --input example.slim.html

# Evaluate
python eval/evaluate.py --pred output.json --gt ground_truth.json
```

---

## 🧪 Citation

If you use NEXT-EVAL in your research, please cite:

```bibtex
@inproceedings{next-eval2025,
  title={NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction},
  author={TBA},
  year={2025}
}
```

---

## 🤝 Contributing

We welcome contributions to improve tool coverage, add datasets, or refine evaluation metrics. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📬 Contact

For questions or collaborations, open an issue or email us at \[[research@wordbricks.ai](mailto:research@wordbricks.ai)].
