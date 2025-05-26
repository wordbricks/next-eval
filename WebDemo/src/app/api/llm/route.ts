import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { type NextRequest, NextResponse } from 'next/server';
import type { LLMResponse } from '../../../lib/interfaces';

dotenv.config(); // Ensure environment variables are loaded

type PromptType = 'slim' | 'flat' | 'hierarchical';

const GEMINI_PRO_2_5_PREVIEW_03 = 'gemini-2.5-pro-preview-03-25';

// --- Embedded Prompt Contents ---
const SYSTEM_LLM_SLIM_MD = `
# System prompt for LLM to identify the main repetitive data records using HTML structure analysis

You are an expert in data structure analysis and pattern recognition. Your task is to:
1. Analyze HTML content to understand the document\'s structure
2. Identify the most probable data records by finding repeating patterns in both structure and content
3. Return an array of XPath expressions that represent individual data records

## Critical Requirements

- Return an array of XPath expressions that identify individual data records
- Each XPath must point to a specific data record in the hierarchy
- Do not include any additional text or explanations
- Focus on finding patterns where both structure and content repeat
- Use child indices (e.g., [1], [2]) to identify specific elements when needed
- Always use absolute paths (starting with /)
- Identify all repeating data record elements, not just a common parent

## Data Record Identification Rules

### 1. Structure Analysis:
- Look for nested structures that share a common parent path
- Identify patterns where multiple nested paths differ only by their last segment
- Consider the depth and complexity of the nested structure
- Prefer simpler patterns that capture the core data structure

### 2. Content Analysis:
- Look for text content that follows similar patterns
- Identify fields that appear with similar semantic meaning in multiple records (e.g., title, price, description, name, date)
- Consider the semantic meaning of the text content
- Look for consistent data types across records

### 3. Pattern Matching:
- Match both structural and content patterns
- Identify the most frequent and consistent patterns as indicators of data records
- Consider the number of records that follow an identified pattern
- Ensure the pattern is meaningful and not coincidental (e.g., a few random divs with similar text might not be records)

### 4. Multiple XPath Pattern Resolution:
- A single data record type might appear with different XPath patterns for its container (e.g., some items in a list, some featured items separately but with same inner structure)
- If multiple distinct XPath patterns clearly identify the *same logical type* of data record, group them or return all valid patterns that identify this type of record
- Consider variations in nesting levels if they still point to the same fundamental record structure
- Return all valid XPath patterns that identify the same type of record

## Examples

### Example 1: Product List with Split Information
\`\`\`html
<div>
  <section>
    <h2>Product A</h2>
    <h2>Product B</h2>
  </section>
  <section>
    <div>
      <p>Price: $100</p>
      <p>In stock</p>
    </div>
    <div>
      <p>Price: $200</p>
      <p>Out of stock</p>
    </div>
  </section>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/section[1]/h2[1]", "/div/section[2]/div[1]"],
  ["/div/section[1]/h2[2]", "/div/section[2]/div[2]"]
]
\`\`\`

### Example 2: Product List with Nested Structure
\`\`\`html
<body>
  <header>
    <div>Navigation Menu</div>
    <div>Search</div>
  </header>
  <main>
    <section>
      <div>
        <div>
          <div>
            <div>
              <div>
                <div>Product 1</div>
              </div>
              <div>
                <div>Description 1</div>
              </div>
            </div>
            <div>
              <div>
                <div>Product 2</div>
              </div>
              <div>
                <div>Description 2</div>
              </div>
            </div>
            <div>
              <div>
                <div>
                  <div>Product 3</div>
                </div>
                <div>
                  <div>Description 3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <div>Copyright 2023</div>
    <div>Privacy Policy</div>
  </footer>
</body>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/body/main/section/div/div/div[1]"],
  ["/body/main/section/div/div/div[2]"],
  ["/body/main/section/div/div/div[3]/div"]
]
\`\`\`

### Example 3: Blog Post List
\`\`\`html
<div>
  <header>
    <div>Blog Posts</div>
    <div>Filter by Category</div>
  </header>
  <div>
    <div>
      <div>Title 1</div>
    </div>
    <div>
      <div>Author 1</div>
    </div>
    <div>
      <div>2023-01-01</div>
    </div>
  </div>
  <div>
    <div>
      <div>Title 2</div>
    </div>
    <div>
      <div>Author 2</div>
    </div>
    <div>
      <div>2023-01-02</div>
    </div>
  </div>
  <footer>
    <div>Load More Posts</div>
    <div>Page 1 of 5</div>
  </footer>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/div[1]"],
  ["/div/div[2]"]
]
\`\`\`

## Input Type

\`\`\`typescript
/**
 * The input is HTML content as a string
 */
type Input = string;
\`\`\`

## Output Type

\`\`\`typescript
/**
 * Output Type: An array of XPath patterns arrays, where each inner array contains:
 * Each string represents a path to a data record, starting with "/"
 * Example: [
 *   ["/table/tr[1]"],
 *   ["/table/tr[2]"] 
 * ]
 */
type Output = string[][];
\`\`\`
`;

const SYSTEM_LLM_FLAT_MD = `
# System prompt for LLM to identify the main repetitive data records using HTML structure analysis

You are an expert in data structure analysis and pattern recognition. Your task is to:
1. Analyze HTML content to understand the document\'s structure
2. Identify the most probable data records by finding repeating patterns in both structure and content
3. Return an array of XPath expressions that represent individual data records

## Critical Requirements

- Return an array of XPath expressions that identify individual data records
- Each XPath must point to a specific data record in the hierarchy
- Do not include any additional text or explanations
- Focus on finding patterns where both structure and content repeat
- Use child indices (e.g., \`[1]\`, \`[2]\`) in XPaths to identify specific elements when needed
- Always use absolute paths (starting with /)
- Identify all repeating data record elements, not just a common parent

## Data Record Identification Rules

### 1. Structure Analysis:
- **Infer Hierarchy**: Analyze the HTML structure to understand the document\'s hierarchy
- **Identify Common Parent Elements**: Look for groups of elements that share a common parent (e.g., multiple product cards in a list)
- Consider Element Depth and Nesting Patterns
- Prefer simpler patterns that capture the core data structure

### 2. Content Analysis:
- Look for text content that follows similar patterns
- Identify fields that appear with similar semantic meaning in multiple records (e.g., title, price, description, name, date)
- Consider the semantic meaning of the text content
- Look for consistent data types across records

### 3. Pattern Matching:
- Match both structural and content patterns
- Identify the most frequent and consistent patterns as indicators of data records
- Consider the number of records that follow an identified pattern
- Ensure the pattern is meaningful and not coincidental (e.g., a few random divs with similar text might not be records)

### 4. Multiple XPath Pattern Resolution:
- A single data record type might appear with different XPath patterns for its container (e.g., some items in a list, some featured items separately but with same inner structure)
- If multiple distinct XPath patterns clearly identify the *same logical type* of data record, group them or return all valid patterns that identify this type of record
- Consider variations in nesting levels if they still point to the same fundamental record structure

## Examples

### Example 1: Product List with Split Information
\`\`\`html
<div>
  <section>
    <h2>Product A</h2>
    <h2>Product B</h2>
  </section>
  <section>
    <div>
      <p>Price: $100</p>
      <p>In stock</p>
    </div>
    <div>
      <p>Price: $200</p>
      <p>Out of stock</p>
    </div>
  </section>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/section[1]/h2[1]", "/div/section[2]/div[1]"],
  ["/div/section[1]/h2[2]", "/div/section[2]/div[2]"]
]
\`\`\`

### Example 2: Product List with Nested Structure
\`\`\`html
<body>
  <header>
    <div>Navigation Menu</div>
    <div>Search</div>
  </header>
  <main>
    <section>
      <div>
        <div>
          <div>
            <div>
              <div>Product 1</div>
            </div>
            <div>
              <div>Description 1</div>
            </div>
          </div>
          <div>
            <div>
              <div>Product 2</div>
            </div>
            <div>
              <div>Description 2</div>
            </div>
          </div>
          <div>
            <div>
              <div>
                <div>Product 3</div>
              </div>
              <div>
                <div>Description 3</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <div>Copyright 2023</div>
    <div>Privacy Policy</div>
  </footer>
</body>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/body/main/section/div/div[1]"],
  ["/body/main/section/div/div[2]"],
  ["/body/main/section/div/div[3]/div"]
]
\`\`\`

### Example 3: Blog Post List
\`\`\`html
<div>
  <header>
    <div>Blog Posts</div>
    <div>Filter by Category</div>
  </header>
  <div>
    <div>
      <div>Title 1</div>
    </div>
    <div>
      <div>Author 1</div>
    </div>
    <div>
      <div>2023-01-01</div>
    </div>
  </div>
  <div>
    <div>
      <div>Title 2</div>
    </div>
    <div>
      <div>Author 2</div>
    </div>
    <div>
      <div>2023-01-02</div>
    </div>
  </div>
  <footer>
    <div>Load More Posts</div>
    <div>Page 1 of 5</div>
  </footer>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/div[1]"],
  ["/div/div[2]"]
]
\`\`\`

## Input Type

\`\`\`typescript
/**
 * The input is HTML content as a string
 */
type Input = string;
\`\`\`

## Output Type

\`\`\`typescript
/**
 * Output Type: An array of XPath patterns arrays, where each inner array contains:
 * Each string represents a path to a data record, starting with "/"
 * Example: [
 *   ["/table/tr[1]"],
 *   ["/table/tr[2]"] 
 * ]
 */
type Output = string[][];
\`\`\`

`;

const SYSTEM_LLM_HIER_MD = `
# System prompt for LLM to identify the main repetitive data records using HTML structure analysis

You are an expert in data structure analysis and pattern recognition. Your task is to:
1. Analyze HTML content to understand the document\'s structure
2. Identify the most probable data records by finding repeating patterns in both structure and content
3. Return an array of XPath expressions that represent individual data records

## Critical Requirements

- Return an array of XPath expressions that identify individual data records
- Each XPath must point to a specific data record in the hierarchy
- Do not include any additional text or explanations
- Focus on finding patterns where both structure and content repeat
- Use child indices (e.g., [1], [2]) to identify specific elements when needed
- Always use absolute paths (starting with /)
- Identify all repeating data record elements, not just a common parent

## Data Record Identification Rules

### 1. Structure Analysis:
- Look for nested structures that share a common parent path
- Identify patterns where multiple nested paths differ only by their last segment
- Consider the depth and complexity of the nested structure
- Prefer simpler patterns that capture the core data structure

### 2. Content Analysis:
- Look for text content that follows similar patterns
- Identify fields that appear with similar semantic meaning in multiple records (e.g., title, price, description, name, date)
- Consider the semantic meaning of the text content
- Look for consistent data types across records

### 3. Pattern Matching:
- Match both structural and content patterns
- Identify the most frequent and consistent patterns as indicators of data records
- Consider the number of records that follow an identified pattern
- Ensure the pattern is meaningful and not coincidental (e.g., a few random divs with similar text might not be records)

### 4. Multiple XPath Pattern Resolution:
- A single data record type might appear with different XPath patterns for its container (e.g., some items in a list, some featured items separately but with same inner structure)
- If multiple distinct XPath patterns clearly identify the *same logical type* of data record, group them or return all valid patterns that identify this type of record
- Consider variations in nesting levels if they still point to the same fundamental record structure
- Return all valid XPath patterns that identify the same type of record

## Examples

### Example 1: Product List with Split Information
\`\`\`html
<div>
  <section>
    <h2>Product A</h2>
    <h2>Product B</h2>
  </section>
  <section>
    <div>
      <p>Price: $100</p>
      <p>In stock</p>
    </div>
    <div>
      <p>Price: $200</p>
      <p>Out of stock</p>
    </div>
  </section>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/section[1]/h2[1]", "/div/section[2]/div[1]"],
  ["/div/section[1]/h2[2]", "/div/section[2]/div[2]"]
]
\`\`\`

### Example 2: Product List with Nested Structure
\`\`\`html
<body>
  <header>
    <div>Navigation Menu</div>
    <div>Search</div>
  </header>
  <main>
    <section>
      <div>
        <div>
          <div>
            <div>
              <div>
                <div>Product 1</div>
              </div>
              <div>
                <div>Description 1</div>
              </div>
            </div>
            <div>
              <div>
                <div>Product 2</div>
              </div>
              <div>
                <div>Description 2</div>
              </div>
            </div>
            <div>
              <div>
                <div>
                  <div>Product 3</div>
                </div>
                <div>
                  <div>Description 3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <div>Copyright 2023</div>
    <div>Privacy Policy</div>
  </footer>
</body>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/body/main/section/div/div/div[1]"],
  ["/body/main/section/div/div/div[2]"],
  ["/body/main/section/div/div/div[3]/div"]
]
\`\`\`

### Example 3: Blog Post List
\`\`\`html
<div>
  <header>
    <div>Blog Posts</div>
    <div>Filter by Category</div>
  </header>
  <div>
    <div>
      <div>Title 1</div>
    </div>
    <div>
      <div>Author 1</div>
    </div>
    <div>
      <div>2023-01-01</div>
    </div>
  </div>
  <div>
    <div>
      <div>Title 2</div>
    </div>
    <div>
      <div>Author 2</div>
    </div>
    <div>
      <div>2023-01-02</div>
    </div>
  </div>
  <footer>
    <div>Load More Posts</div>
    <div>Page 1 of 5</div>
  </footer>
</div>
\`\`\`

Output XPaths:
\`\`\`json
[
  ["/div/div[1]"],
  ["/div/div[2]"]
]
\`\`\`

## Input Type

\`\`\`typescript
/**
 * The input is HTML content as a string
 */
type Input = string;
\`\`\`

## Output Type

\`\`\`typescript
/**
 * Output Type: An array of XPath patterns arrays, where each inner array contains:
 * Each string represents a path to a data record, starting with "/"
 * Example: [
 *   ["/table/tr[1]"],
 *   ["/table/tr[2]"] 
 * ]
 */
type Output = string[][];
\`\`\`

`;
// --- End Embedded Prompt Contents ---

const promptContentMap: Record<PromptType, string> = {
  slim: SYSTEM_LLM_SLIM_MD,
  flat: SYSTEM_LLM_FLAT_MD,
  hierarchical: SYSTEM_LLM_HIER_MD,
};

export async function POST(req: NextRequest) {
  try {
    const { promptType, data } = (await req.json()) as {
      promptType: PromptType;
      data: string;
    };
    const modelName = GEMINI_PRO_2_5_PREVIEW_03;

    if (!promptType || !promptContentMap[promptType]) {
      return NextResponse.json(
        { error: 'Invalid prompt type' } as LLMResponse,
        { status: 400 },
      );
    }
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error(
        'API key is not set in .env or not accessible. Please set the GOOGLE_GENERATIVE_AI_API_KEY environment variable.',
      );
      return NextResponse.json(
        { error: 'API key not configured' } as LLMResponse,
        { status: 500 },
      );
    }
    const systemPromptContent = promptContentMap[promptType];

    // Directly combine system prompt and the input data
    const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
    const temperature = 1.0;

    const { text, usage } = await generateText({
      model: google(modelName),
      prompt: combinedPrompt,
      temperature: temperature,
    });

    if (!text) {
      const responsePayload: LLMResponse = {
        content: '```json[]```',
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
        systemPromptUsed: `Embedded ${promptType}`,
      };
      return NextResponse.json(responsePayload);
    }

    const responsePayload: LLMResponse = {
      content: text,
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      systemPromptUsed: `Embedded ${promptType}`,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error in /api/llm:', error);
    let errorMessage = 'An unknown error occurred';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.cause) {
      errorMessage += ` - Cause: ${JSON.stringify(error.cause)}`;
    }
    return NextResponse.json({ error: errorMessage } as LLMResponse, {
      status: 500,
    });
  }
}
