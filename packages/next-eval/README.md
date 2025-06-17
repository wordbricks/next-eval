# @wordbricks/next-eval

Web data record extraction and evaluation library.

## Installation

```bash
npm install @wordbricks/next-eval
```

## Usage

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

const promptType = "slim"; // Options: "flat", "hier", "slim"
const data = slimmedHtml; // Use textMapFlat or textMap for other formats
const temperature = 1.0; // Control randomness (0.0 to 2.0)

const { text, usage } = await getLLMResponse(data, promptType, temperature);

console.log("Extracted table data:", text);
console.log("API usage:", usage);
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