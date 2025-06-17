// Simple DOM parser shim for hybrid browser/Node.js support
// No OOP - just functions

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";

// Lazy-load linkedom only in Node.js environment
let linkedom: typeof import("linkedom") | null = null;

function getLinkedom() {
  if (!linkedom && !isBrowser) {
    // Use require for synchronous loading
    linkedom = require("linkedom");
  }
  return linkedom;
}

// Parse HTML string to Document
export function parseHTML(html: string): Document {
  if (isBrowser) {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  const ld = getLinkedom();
  if (!ld) {
    throw new Error("linkedom not available in Node.js environment");
  }

  // Use linkedom's parseHTML which returns a document
  const { document } = ld.parseHTML(html);
  return document;
}

// Get outer HTML from element
export function getOuterHTML(element: Document | Element): string {
  if (isBrowser) {
    if ("documentElement" in element && element.documentElement) {
      return element.documentElement.outerHTML;
    }
    if ("outerHTML" in element) {
      return element.outerHTML;
    }
  }

  // Node.js environment - node-html-parser
  if ("outerHTML" in element) {
    return element.outerHTML;
  }

  if ("toString" in element && typeof element.toString === "function") {
    return element.toString();
  }

  return "";
}

// Query selector wrapper
export function querySelector(
  element: Document | Element,
  selector: string,
): Element | null {
  if (
    "querySelector" in element &&
    typeof element.querySelector === "function"
  ) {
    return element.querySelector(selector);
  }
  return null;
}

// Query selector all wrapper
export function querySelectorAll(
  element: Document | Element,
  selector: string,
): Element[] {
  if (
    "querySelectorAll" in element &&
    typeof element.querySelectorAll === "function"
  ) {
    const nodeList = element.querySelectorAll(selector);
    return Array.from(nodeList);
  }
  return [];
}

// Get all elements by tag name
export function getElementsByTagName(
  element: Document | Element,
  tagName: string,
): Element[] {
  if (
    "getElementsByTagName" in element &&
    typeof element.getElementsByTagName === "function"
  ) {
    const collection = element.getElementsByTagName(tagName);
    return Array.from(collection);
  }

  // Fallback for node-html-parser
  if ("querySelectorAll" in element) {
    return querySelectorAll(element, tagName);
  }

  return [];
}

// Remove element
export function removeElement(element: Element): void {
  if ("remove" in element && typeof element.remove === "function") {
    element.remove();
  }
}

// Get/remove attributes
export function getAttribute(element: Element, name: string): string | null {
  if ("getAttribute" in element && typeof element.getAttribute === "function") {
    return element.getAttribute(name) || null;
  }
  return null;
}

export function removeAttribute(element: Element, name: string): void {
  if (
    "removeAttribute" in element &&
    typeof element.removeAttribute === "function"
  ) {
    element.removeAttribute(name);
  }
}

// Get element attributes
export function getAttributes(
  element: Element,
): { name: string; value: string }[] {
  const attrs: { name: string; value: string }[] = [];

  if ("attributes" in element && element.attributes) {
    const attributes = element.attributes as any;

    // Browser NamedNodeMap
    if (typeof attributes.length === "number") {
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i] || attributes.item(i);
        if (attr && "name" in attr && "value" in attr) {
          attrs.push({ name: attr.name, value: attr.value });
        }
      }
    }
    // node-html-parser object format
    else if (typeof attributes === "object") {
      for (const [name, value] of Object.entries(attributes)) {
        attrs.push({ name, value: String(value) });
      }
    }
  }

  return attrs;
}

// Create HTML document (for Node.js compatibility)
export function createHTMLDocument(title = ""): Document {
  if (
    isBrowser &&
    document.implementation &&
    document.implementation.createHTMLDocument
  ) {
    return document.implementation.createHTMLDocument(title);
  }

  // In Node.js, create an empty HTML structure
  const html = `<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`;
  return parseHTML(html);
}

// Set inner HTML
export function setInnerHTML(element: Element, html: string): void {
  if ("innerHTML" in element) {
    element.innerHTML = html;
  }
}

// Create tree walker for text nodes (browser-compatible)
export function createTreeWalker(
  root: Document | Element,
  whatToShow = 0x04, // NodeFilter.SHOW_TEXT
): { nextNode: () => any } {
  if (isBrowser && "createTreeWalker" in root) {
    // Browser environment - use native TreeWalker
    const walker = (root as Document).createTreeWalker(
      root.documentElement || (root as Node),
      whatToShow,
      {
        acceptNode: (node: Node) => {
          if (node.nodeValue && node.nodeValue.trim() !== "") {
            let parent = node.parentElement;
            while (parent) {
              if (["SCRIPT", "STYLE"].includes(parent.tagName)) {
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
    return walker;
  } else {
    // Node.js environment - implement TreeWalker-like behavior
    const nodes: any[] = [];
    let currentIndex = -1;

    function collectTextNodes(node: any): void {
      if (!node) return;

      // Skip script and style elements entirely
      const tagName = (node.tagName || node.nodeName || "").toUpperCase();
      if (["SCRIPT", "STYLE"].includes(tagName)) {
        return;
      }

      // Check all child nodes
      const childNodes = node.childNodes || [];
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (!child) continue;

        // Text node
        if (child.nodeType === 3 || (child.text && !child.tagName)) {
          const text = (
            child.nodeValue ||
            child.text ||
            child.data ||
            ""
          ).trim();
          if (text) {
            // Ensure parentElement is available for node-html-parser text nodes
            if (!child.parentElement && node) {
              child.parentElement = node;
            }
            nodes.push(child);
          }
        }
        // Element node - recurse
        else if (child.nodeType === 1 || child.tagName) {
          collectTextNodes(child);
        }
      }
    }

    // Collect all text nodes
    const startNode = (root as any).documentElement || root;
    collectTextNodes(startNode);

    // Return TreeWalker-like interface
    return {
      nextNode(): any {
        currentIndex++;
        return currentIndex < nodes.length ? nodes[currentIndex] : null;
      },
    };
  }
}
