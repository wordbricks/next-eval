export interface TextMapNode {
  [key: string]: string | TextMapNode;
}

// Helper function to read file as text
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// Helper function to generate a simple XPath for an element
export const generateXPath = (element: Element | null): string => {
  if (!element) return '';
  // Prioritize id if present and it's reasonably simple (e.g., no spaces, not just a number)
  if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id))
    return `id(\'${element.id}\')`;

  let path = '';
  let currentElement: Element | null = element;
  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let siblingIndex = 1;
    let sibling = currentElement.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === currentElement.nodeName) {
        siblingIndex++;
      }
      sibling = sibling.previousElementSibling;
    }
    const tagName = currentElement.nodeName.toLowerCase();
    const segment = siblingIndex > 1 ? `[${siblingIndex}]` : '';
    path = `/${tagName}${segment}${path}`;
    currentElement = currentElement.parentElement;
  }
  // Remove leading /html if present to make paths relative to html's direct children (head, body)
  if (path.startsWith('/html/')) {
    return path.substring(5); // length of "/html"
  }
  return path || '/';
};

// Helper function to download content as a file
export const handleDownload = (
  content: string,
  fileName: string,
  contentType: string,
) => {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link); // Required for Firefox
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); // Clean up
};

// Helper function to remove script, style tags, and comments from HTML
export const slimHtml = (doc: Document): string => {
  // 1. Initial DOM-based removal of specific tags
  for (const el of doc.querySelectorAll('script')) {
    el.remove();
  }
  for (const el of doc.querySelectorAll('style')) {
    el.remove();
  }
  for (const el of doc.querySelectorAll('meta')) {
    if (el.getAttribute('charset') === null) {
      el.remove();
    }
  }
  for (const el of doc.querySelectorAll('link')) {
    el.remove();
  }

  // 2. Convert to string
  const htmlContent = doc.documentElement ? doc.documentElement.outerHTML : '';
  if (!htmlContent) {
    return ''; // Return empty if no content after initial cleaning
  }

  // Perform string-based cleaning (includes comment removal)
  const stringCleanedContent = htmlContent
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\n\s*\n/g, '\n') // Remove multiple consecutive line breaks
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace

  // 3. Create a new document from the string-cleaned content
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(stringCleanedContent, 'text/html');

  // 4. Remove all attributes from all elements in the new document
  if (tempDoc.documentElement) {
    const elements = tempDoc.getElementsByTagName('*');
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
  return tempDoc.documentElement ? tempDoc.documentElement.outerHTML : '';
};

// Helper function to extract text and build flat/hierarchical maps
export const extractTextWithXPaths = (
  doc: Document,
): { textMapFlat: Record<string, string>; textMap: TextMapNode } => {
  const textMapFlat: Record<string, string> = {};
  const textMap: TextMapNode = {};
  const treeWalker = doc.createTreeWalker(
    doc.documentElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Node) => {
        // Only accept non-empty text nodes that are not inside <script> or <style>
        if (node.nodeValue && node.nodeValue.trim() !== '') {
          let parent = node.parentElement;
          while (parent) {
            if (['SCRIPT', 'STYLE'].includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const textContent = currentNode.nodeValue?.trim();
    if (textContent && currentNode.parentElement) {
      const xpath = generateXPath(currentNode.parentElement);
      textMapFlat[xpath] = textContent;

      // Build hierarchical map (simplified version)
      const parts = xpath.substring(1).split('/');
      let currentLevel = textMap;
      parts.forEach((part, index) => {
        const key = part.replace(/\W/g, '_'); // Sanitize part to be a valid key
        if (index === parts.length - 1) {
          currentLevel[key] = textContent;
        } else {
          if (!currentLevel[key] || typeof currentLevel[key] === 'string') {
            currentLevel[key] = {};
          }
          currentLevel = currentLevel[key] as TextMapNode;
        }
      });
    }
    currentNode = treeWalker.nextNode();
  }
  return { textMapFlat, textMap };
};

// Helper function to process HTML content
export const processHtmlContent = async (htmlString: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // 1. Slim the HTML
  const cleanedHtml = slimHtml(doc);
  const htmlLength = cleanedHtml.length;

  // Re-parse the cleaned HTML to ensure XPaths are generated from the modified structure
  const cleanedDoc = parser.parseFromString(cleanedHtml, 'text/html');

  // 2. Extract text and XPaths
  const { textMapFlat, textMap } = extractTextWithXPaths(cleanedDoc);

  const textMapFlatString = JSON.stringify(textMapFlat, null, 2);
  const textMapFlatLength = textMapFlatString.length;
  const textMapString = JSON.stringify(textMap, null, 2);
  const textMapLength = textMapString.length;

  return {
    html: cleanedHtml,
    textMapFlat,
    textMap,
    htmlLength,
    textMapFlatLength,
    textMapLength,
  };
};
