import { calculateEvaluationMetrics } from "../evaluation/utils/calculateEvaluationMetrics";
import { calculateOverlap } from "../evaluation/utils/calculateOverlap";
import { mapResponseToFullXpath } from "../evaluation/utils/mapResponseToFullXpath";
import type { DOMParser } from "../html/utils/domParser";
import { createDOMContext } from "../html/utils/domParser";
import { extractTextWithXPaths } from "../html/utils/extractTextWithXPaths";
import { processHtmlContent } from "../html/utils/processHtmlContent";
import { slimHtml } from "../html/utils/slimHtml";
import type {
  HtmlResult,
  NestedTextMap,
} from "../shared/interfaces/HtmlResult";

/**
 * Processor for HTML processing with pipe-friendly functions
 *
 * @example
 * ```typescript
 * import { pipe } from "@fxts/core";
 * import { createProcessor } from "@wordbricks/next-eval";
 *
 * const processor = createProcessor({ parser: customParser });
 *
 * // Basic pipeline
 * const result = pipe(
 *   htmlString,
 *   processor.parseHtml,
 *   processor.slimDocument,
 *   processor.extractText
 * );
 *
 * // Extract just the slimmed HTML
 * const slimmed = pipe(
 *   htmlString,
 *   processor.parseHtml,
 *   processor.slimDocument,
 *   (result) => result.slimmedHtml
 * );
 *
 * // Evaluation with curried functions
 * const metrics = pipe(
 *   predictedRecords,
 *   processor.calculateEvaluationMetrics(groundTruthRecords)
 * );
 * ```
 */
export interface ProcessorOptions {
  parser?: DOMParser;
}

// Individual function signatures for better composability
export interface Processor {
  // Core HTML processing functions - designed to pipe well
  parseHtml: (html: string) => Document;
  slimDocument: (doc: Document) => { document: Document; slimmedHtml: string };
  extractText: (doc: Document) => {
    document: Document;
    textMapFlat: Record<string, string>;
    textMap: NestedTextMap;
  };

  // Evaluation functions
  mapResponseToFullXpath: (
    textMapFlatJson: Record<string, any>,
  ) => (response: string[][]) => string[][];
  calculateEvaluationMetrics: (
    groundTruthRecords: string[][],
  ) => (
    predictedRecords: string[][],
  ) => ReturnType<typeof calculateEvaluationMetrics>;
  calculateOverlap: (
    groundTruth: string[],
  ) => (predicted: string[]) => ReturnType<typeof calculateOverlap>;

  // Legacy functions for compatibility
  processHtmlContent: (htmlString: string) => HtmlResult;
  slimHtml: (doc: Document) => string;
  extractTextWithXPaths: (doc: Document) => {
    textMapFlat: Record<string, string>;
    textMap: NestedTextMap;
  };

  // Expose context for compatibility
  context?: ReturnType<typeof createDOMContext>;
}

export const createProcessor = (options?: ProcessorOptions): Processor => {
  const context = options?.parser
    ? createDOMContext(options.parser)
    : createDOMContext();

  return {
    // Core pipeline functions
    parseHtml: (html: string) => context.parseHTML(html),

    slimDocument: (doc: Document) => {
      const slimmedHtml = slimHtml(doc, context);
      // Return both for flexibility in pipelines
      return { document: doc, slimmedHtml };
    },

    extractText: (doc: Document) => {
      const extracted = extractTextWithXPaths(doc, context);
      return {
        document: doc,
        ...extracted,
      };
    },

    // Curried evaluation functions for better composition
    mapResponseToFullXpath:
      (textMapFlatJson: Record<string, any>) => (response: string[][]) =>
        mapResponseToFullXpath(textMapFlatJson, response),

    calculateEvaluationMetrics:
      (groundTruthRecords: string[][]) => (predictedRecords: string[][]) =>
        calculateEvaluationMetrics(predictedRecords, groundTruthRecords),

    calculateOverlap: (groundTruth: string[]) => (predicted: string[]) =>
      calculateOverlap(predicted, groundTruth),

    // Legacy compatibility functions
    processHtmlContent: (htmlString: string) =>
      processHtmlContent(htmlString, context),

    slimHtml: (doc: Document) => slimHtml(doc, context),

    extractTextWithXPaths: (doc: Document) =>
      extractTextWithXPaths(doc, context),

    context,
  };
};

// Convenience function to create processor with default context
export const defaultProcessor = createProcessor();
