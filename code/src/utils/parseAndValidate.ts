import { xpathArraySchema } from "../constant";
import { z } from "zod";

export const parseAndValidateXPaths = (content: string): z.infer<typeof xpathArraySchema> => {
	try {
		// Remove markdown code block syntax if present
		let cleanedContent = content.trim();
		if (cleanedContent.startsWith("```json") && cleanedContent.endsWith("```")) {
			cleanedContent = cleanedContent.slice(7, -3).trim();
		}

		// Try to parse the content as JSON first
		const parsedData = JSON.parse(cleanedContent);
		// Validate the parsed data against our XPath schema
		return xpathArraySchema.parse(parsedData);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(`Invalid array format: ${error.errors.map(e => e.message).join(", ")}`);
		}
		if (error instanceof SyntaxError) {
			throw new Error("Invalid JSON format in LLM response");
		}
		throw error;
	}
};