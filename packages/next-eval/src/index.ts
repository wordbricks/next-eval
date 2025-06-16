// Shared interfaces and types
export * from "./shared/interfaces/types";
export * from "./shared/interfaces/LLMResponse";
export * from "./shared/interfaces/HtmlResult";
export * from "./shared/interfaces/TagNode";

// Shared utilities
export * from "./shared/utils/buildTagTree";

// Evaluation interfaces
export * from "./evaluation/interfaces/EvaluationResult";

// Evaluation utilities
export * from "./evaluation/utils/calculateEvaluationMetrics";
export * from "./evaluation/utils/calculateOverlap";
export * from "./evaluation/utils/mapResponseToFullXpath";

// HTML processing utilities
export * from "./html/utils/extractTextWithXPaths";
export * from "./html/utils/generateXPath";
export * from "./html/utils/processHtmlContent";
export * from "./html/utils/removeCommentScriptStyleFromHTML";
export * from "./html/utils/slimHtml";

// LLM constants
export * from "./llm/constants";

// LLM utilities
export * from "./llm/utils/compile";
// Note: getLLMResponse is excluded as it depends on promptLoader which uses Node.js APIs
// Import from @wordbricks/next-eval/server for server-side usage
