import type { HtmlResult } from "@next-eval/shared";
import { launchBrowser } from "@/utils/launchBrowser";

/**
 * Processes HTML content by cleaning it and extracting text content with XPaths
 * @param mhtmlPath - Path to the MHTML file to process
 * @returns Promise that resolves with cleaned HTML and text content map
 */
export const getHTMLAndTextMapFromMHTML = async (
	mhtmlPath: string,
): Promise<HtmlResult> => {
	const browser = await launchBrowser();
	const page = await browser.newPage();

	// Load the MHTML file
	await page.goto(`file://${mhtmlPath}`, { waitUntil: "networkidle0" });
	const result = await page.evaluate(
		(): { html: string; textMap: [string, string][] } => {
			const textMap = new Map<string, string>();

			// Function to get simple XPath of an element
			const getSimpleXPath = (element: Element): string => {
				const path: string[] = [];
				let current: Element | null = element;

				while (current && current !== document.documentElement) {
					const tag = current.tagName.toLowerCase();
					const siblings = Array.from(
						current.parentNode?.children || [],
					).filter((child) => child.tagName === current?.tagName);
					const index = siblings.indexOf(current) + 1;
					path.unshift(`${tag}[${index}]`);
					current = current.parentElement;
				}

				return `/${path.join("/")}`;
			};

			// Function to process text nodes
			const processTextNodes = (node: Node) => {
				if (node.nodeType === Node.TEXT_NODE) {
					const text = node.textContent?.trim();
					if (text && text.length > 0) {
						const parentElement = node.parentElement;
						if (parentElement) {
							const xpath = getSimpleXPath(parentElement);
							textMap.set(xpath, text);
						}
					}
				} else {
					node.childNodes.forEach(processTextNodes);
				}
			};

			// Remove script tags
			document.querySelectorAll("script").forEach((el) => el.remove());

			// Remove style tags
			document.querySelectorAll("style").forEach((el) => el.remove());

			// Remove meta tags except for charset
			document.querySelectorAll("meta").forEach((el) => {
				if (el.getAttribute("charset") === null) {
					el.remove();
				}
			});

			// Remove link tags
			document.querySelectorAll("link").forEach((el) => el.remove());

			// Remove comments
			const walker = document.createTreeWalker(
				document,
				NodeFilter.SHOW_COMMENT,
				null,
			);
			let node: Comment | null;
			while ((node = walker.nextNode() as Comment | null)) {
				if (node) {
					node.remove();
				}
			}

			// Process all text nodes
			processTextNodes(document.documentElement);

			// Clean the HTML
			const htmlContent = document.documentElement.outerHTML;
			const cleanedContent = htmlContent
				.replace(/<!--[\s\S]*?-->/g, "") // Remove comments
				.replace(/\n\s*\n/g, "\n") // Remove multiple consecutive line breaks
				.replace(/>\s+</g, "><") // Remove whitespace between tags
				.replace(/\s+/g, " ") // Replace multiple spaces with single space
				.trim(); // Remove leading/trailing whitespace

			// Create a new document from the cleaned content
			const parser = new DOMParser();
			const doc = parser.parseFromString(cleanedContent, "text/html");

			// Remove all attributes except for essential ones
			const elements = doc.getElementsByTagName("*");
			for (const element of elements) {
				const attributes = element.attributes;
				for (let i = attributes.length - 1; i >= 0; i--) {
					const attr = attributes[i];
					element.removeAttribute(attr.name);
				}
			}

			return {
				html: doc.documentElement.outerHTML,
				textMap: Array.from(textMap.entries()),
			};
		},
	);

	await browser.close();
	const newTextMap = result.textMap.filter(([_, text]) => {
		if (text.length > 1) {
			return true;
		}
		const charCode = `${text[0]?.charCodeAt(0).toString(16).padStart(4, '0') ?? "0000"}`;
		if (charCode === "200c" || charCode === "200b" || charCode === "0022") {
			return false;
		}
		return true; 
	});//handle whitespace character

	return {
		html: result.html,
		textMap: newTextMap.reduce(
			(acc, [xpath, text]) => {
				// Split the xpath into segments
				const segments = xpath.split("/").filter(Boolean);

				// Build nested structure
				let current = acc;
				for (let i = 0; i < segments.length - 1; i++) {
					const segment = segments[i];
					if (typeof current[segment] !== "object") {
						current[segment] = {};
					}
					current = current[segment] as Record<string, any>;
				}

				// Set the text at the last segment
				const lastSegment = segments[segments.length - 1];
				current[lastSegment] = text;

				return acc;
			},
			{} as Record<string, any>,
		),
		textMapFlat: newTextMap.reduce(
			(acc, [xpath, text]) => {
				acc[xpath] = text;
				return acc;
			},
			{} as Record<string, string>,
		),
	};
};

