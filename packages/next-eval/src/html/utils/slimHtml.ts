import { createDOMContext } from "./domParser";

// Helper function to remove script, style tags, and comments from HTML
export const slimHtml = (
  doc: Document,
  domContext?: ReturnType<typeof createDOMContext>,
): string => {
  // Use provided context or create default one
  const ctx = domContext || createDOMContext();
  // 1. Initial DOM-based removal of specific tags
  for (const el of ctx.querySelectorAll(doc, "script")) {
    ctx.removeElement(el);
  }
  for (const el of ctx.querySelectorAll(doc, "style")) {
    ctx.removeElement(el);
  }
  for (const el of ctx.querySelectorAll(doc, "meta")) {
    if (ctx.getAttribute(el, "charset") === null) {
      ctx.removeElement(el);
    }
  }
  for (const el of ctx.querySelectorAll(doc, "link")) {
    ctx.removeElement(el);
  }

  // 2. Convert to string
  const htmlContent = ctx.getOuterHTML(doc);
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
  const tempDoc = ctx.parseHTML(stringCleanedContent);

  // 4. Remove all attributes from all elements in the new document
  const elements = ctx.getElementsByTagName(tempDoc, "*");
  for (const element of elements) {
    const attributes = ctx.getAttributes(element);
    // Remove all attributes
    for (const attr of attributes) {
      ctx.removeAttribute(element, attr.name);
    }
  }

  // 5. Return the final cleaned HTML
  return ctx.getOuterHTML(tempDoc);
};
