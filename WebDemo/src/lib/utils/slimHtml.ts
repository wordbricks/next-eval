// Helper function to remove script, style tags, and comments from HTML
export const slimHtml = (doc: Document): string => {
  // 1. Initial DOM-based removal of specific tags
  for (const el of doc.querySelectorAll("script")) {
    el.remove();
  }
  for (const el of doc.querySelectorAll("style")) {
    el.remove();
  }
  for (const el of doc.querySelectorAll("meta")) {
    if (el.getAttribute("charset") === null) {
      el.remove();
    }
  }
  for (const el of doc.querySelectorAll("link")) {
    el.remove();
  }

  // 2. Convert to string
  const htmlContent = doc.documentElement ? doc.documentElement.outerHTML : "";
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
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(stringCleanedContent, "text/html");

  // 4. Remove all attributes from all elements in the new document
  if (tempDoc.documentElement) {
    const elements = tempDoc.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const attributes = element.attributes;
      // Iterate backwards because attributes is a live collection
      for (let j = attributes.length - 1; j >= 0; j--) {
        const attr = attributes[j];
        element.removeAttribute(attr.name);
      }
    }
  }

  // 5. Return the final cleaned HTML
  return tempDoc.documentElement ? tempDoc.documentElement.outerHTML : "";
};
