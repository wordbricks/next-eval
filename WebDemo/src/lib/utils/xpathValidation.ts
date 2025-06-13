import { z } from "zod";

// Schema for an array of arrays of strings (e.g., [["xpath1"], ["xpath2"]])
export const xpathArraySchema = z.array(z.array(z.string().trim().min(1)));

export type ValidatedXpathArray = z.infer<typeof xpathArraySchema>;

export const parseAndValidateXPaths = (
  content: string,
): ValidatedXpathArray | null => {
  try {
    let cleanedContent = content.trim();
    // Remove markdown code block syntax if present
    if (
      cleanedContent.startsWith("```json") &&
      cleanedContent.endsWith("```")
    ) {
      cleanedContent = cleanedContent.slice(7, -3).trim(); // "```json".length is 7
    } else if (
      cleanedContent.startsWith("```") &&
      cleanedContent.endsWith("```")
    ) {
      cleanedContent = cleanedContent.slice(3, -3).trim(); // "```".length is 3
    }
    const parsedData = JSON.parse(cleanedContent);
    const validationResult = xpathArraySchema.safeParse(parsedData);

    if (validationResult.success) return validationResult.data;
    console.error(
      "XPath validation error (primary schema):",
      validationResult.error.flatten(),
    );
    if (
      Array.isArray(parsedData) &&
      parsedData.every((item) => typeof item === "string")
    ) {
      const coercedData = parsedData.map((xpath) => [xpath]);
      const coercedValidationResult = xpathArraySchema.safeParse(coercedData);
      if (coercedValidationResult.success) {
        console.warn("Coerced flat array of strings (string[]) to string[][].");
        return coercedValidationResult.data;
      }
      console.error(
        "XPath validation error (after string[] coercion):",
        coercedValidationResult.error.flatten(),
      );
    }
    return null;
  } catch (error) {
    // Catch errors from JSON.parse or other unexpected issues
    console.error(
      "JSON parsing or other unexpected error in parseAndValidateXPaths:",
      error,
    );
    return null;
  }
};
