// Helper function to generate a simple XPath for an element
export const generateXPath = (element: any): string => {
  if (!element) return "";

  // Check for ID attribute (works in both environments)
  const id = element.id || element.getAttribute?.("id");
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) {
    return `id('${id}')`;
  }

  let path = "";
  let currentElement: any = element;

  while (
    currentElement &&
    (currentElement.nodeType === 1 || currentElement.tagName)
  ) {
    let siblingIndex = 1;

    // Get previous siblings - handle both browser and linkedom
    if (currentElement.previousElementSibling) {
      // Browser API
      let sibling = currentElement.previousElementSibling;
      while (sibling) {
        if (
          sibling.nodeName === currentElement.nodeName ||
          sibling.tagName === currentElement.tagName
        ) {
          siblingIndex++;
        }
        sibling = sibling.previousElementSibling;
      }
    } else if (currentElement.parentNode || currentElement.parentElement) {
      // linkedom fallback - count siblings manually
      const parent = currentElement.parentNode || currentElement.parentElement;
      const children = parent.childNodes || parent.children || [];
      const nodeName = currentElement.nodeName || currentElement.tagName;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child === currentElement) break;
        if ((child.nodeName || child.tagName) === nodeName) {
          siblingIndex++;
        }
      }
    }

    const tagName = (
      currentElement.nodeName ||
      currentElement.tagName ||
      ""
    ).toLowerCase();
    const segment = `[${siblingIndex}]`;
    path = `/${tagName}${segment}${path}`;
    currentElement = currentElement.parentElement || currentElement.parentNode;
  }

  // Remove leading /html if present to make paths relative to html's direct children (head, body)
  if (path.startsWith("/html[1]/")) {
    // FIXME Is it correct?
    return path.substring(8); // length of "/html"
  }
  return path || "/";
};
