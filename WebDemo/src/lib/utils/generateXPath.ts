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
    const segment = `[${siblingIndex}]`;
    path = `/${tagName}${segment}${path}`;
    currentElement = currentElement.parentElement;
  }
  // Remove leading /html if present to make paths relative to html's direct children (head, body)
  if (path.startsWith('/html[1]/')) {
    return path.substring(8); // length of "/html"
  }
  return path || '/';
};
