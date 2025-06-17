import {
  getAttribute,
  getAttributes,
  getElementsByTagName,
  getOuterHTML,
  parseHTML,
  querySelectorAll,
  removeAttribute,
  removeElement,
} from "./domParser";

// Helper function to remove script, style tags, and comments from HTML
export const slimHtml = (doc: Document): string => {
  // 1. Initial DOM-based removal of specific tags
  for (const el of querySelectorAll(doc, "script")) {
    removeElement(el);
  }
  for (const el of querySelectorAll(doc, "style")) {
    removeElement(el);
  }
  for (const el of querySelectorAll(doc, "meta")) {
    if (getAttribute(el, "charset") === null) {
      removeElement(el);
    }
  }
  for (const el of querySelectorAll(doc, "link")) {
    removeElement(el);
  }

  // 2. Convert to string
  const htmlContent = getOuterHTML(doc);
  if (!htmlContent) {
    return ""; // Return empty if no content after initial cleaning
  }

  // Perform string-based cleaning (includes comment removal)
  const stringCleanedContent = htmlContent
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
    .replace(/\n\s*\n/g, "\n") // Remove multiple consecutive line breaks
    .replace(/>\s+</g, "><") // Remove whitespace between tags
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace

  // 3. Create a new document from the string-cleaned content
  const tempDoc = parseHTML(stringCleanedContent);

  // 4. Remove all attributes from all elements in the new document
  const elements = getElementsByTagName(tempDoc, "*");
  for (const element of elements) {
    const attributes = getAttributes(element);
    // Remove all attributes
    for (const attr of attributes) {
      removeAttribute(element, attr.name);
    }
  }

  // 5. Return the final cleaned HTML
  return getOuterHTML(tempDoc);
};
