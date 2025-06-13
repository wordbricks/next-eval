import {
  type HTMLElement,
  type Node,
  NodeType,
  type TextNode,
} from "node-html-parser";

export interface TagNode {
  tag: string;
  children: TagNode[];
  rawText: string;
  xpath: string;
}
export function buildTagTree(domNode: Node, parentElementXPath = ""): TagNode {
  if (!domNode) {
    return { tag: "text", children: [], rawText: "", xpath: "" };
  }

  // Handle text nodes
  if (domNode.nodeType === NodeType.TEXT_NODE) {
    const textContent = ((domNode as TextNode)?.text || "").trim();
    let textNodeXPath = "";

    // Construct XPath for text node if it has content and a parent XPath is provided
    if (textContent && parentElementXPath) {
      // Assign the parent element's XPath directly to the text node
      textNodeXPath = parentElementXPath;
    }
    return {
      tag: "text",
      children: [],
      rawText: textContent,
      xpath: textNodeXPath,
    };
  }

  // Handle element nodes
  if (domNode.nodeType === NodeType.ELEMENT_NODE) {
    const element = domNode as HTMLElement;
    if (!element || typeof element.tagName !== "string") {
      // Fallback for invalid element structure
      return { tag: "div", children: [], rawText: "", xpath: "" };
    }

    const tagName = element.tagName.toLowerCase();
    let localXPathSegment: string;

    const parent = element.parentNode;
    // Determine the local XPath segment (tagName[index])
    if (!parent || parent.nodeType !== NodeType.ELEMENT_NODE) {
      // This element is the top-most in its current hierarchy or fragment root
      localXPathSegment = `${tagName}[1]`;
    } else {
      const parentElement = parent as HTMLElement;
      const siblingsWithSameTag = parentElement.childNodes.filter(
        (siblingNode): siblingNode is HTMLElement =>
          siblingNode.nodeType === NodeType.ELEMENT_NODE &&
          (siblingNode as HTMLElement).tagName === element.tagName,
      );
      // Ensure 'element' itself is an HTMLElement for indexOf
      const index = siblingsWithSameTag.indexOf(element) + 1;
      localXPathSegment = `${tagName}[${index > 0 ? index : 1}]`;
    }

    let currentElementXPath: string;
    if (parentElementXPath === "") {
      // This is the root element of the buildTagTree call
      currentElementXPath = `/${localXPathSegment}`;
    } else {
      // Append to parent's XPath
      currentElementXPath = `${parentElementXPath}/${localXPathSegment}`;
    }

    const children: TagNode[] = [];
    const childNodes = element.childNodes || [];

    for (const child of childNodes) {
      if (!child) continue;

      if (child.nodeType === NodeType.TEXT_NODE) {
        const text = (child as TextNode)?.text || "";
        if (text.trim() === "") continue; // Skip if it's an effectively empty text node
      }
      children.push(buildTagTree(child, currentElementXPath));
    }

    return { tag: tagName, children, rawText: "", xpath: currentElementXPath };
  }

  // For any other node types (e.g., comments, if not filtered out before this stage)
  return { tag: "text", children: [], rawText: "", xpath: "" }; // Default fallback
}
