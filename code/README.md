# NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction

## How to Run 
```bash
# Convert MHTML into input file for LLM
bun run preprocess 

# Generate data records using MDR
bun run mdr

# Generate data records using LLM
bun run runLLM <mode> <groupIndex>

# Evaluate
bun run evaluate
```
*   `<mode>`: Specifies the processing mode. Choose one of:
    *   `slim`
    *   `hier`
    *   `flat`
*   `<groupIndex>`: A number indicating the data split to process. Must be an integer from 1 to 5.

