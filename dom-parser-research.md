# DOM Parser Libraries Research for next-eval

## Current Situation Analysis

### Requirements Based on Code Review

1. **DOM APIs Used:**
   - `DOMParser` API for parsing HTML strings
   - `Document` interface with methods:
     - `querySelectorAll()` for element selection
     - `getElementsByTagName()` for getting all elements
     - `createTreeWalker()` for traversing text nodes
     - `documentElement` property
     - `implementation.createHTMLDocument()` fallback
   - `Element` interface with:
     - `remove()` method
     - `getAttribute()` / `removeAttribute()` methods
     - `attributes` collection
     - `outerHTML` property
     - `parentElement` / `previousElementSibling` properties
     - `nodeName` / `tagName` properties
     - `id` property
   - `Node` interface with:
     - `nodeType` constants (ELEMENT_NODE, TEXT_NODE)
     - `nodeValue` property
     - `parentNode` / `childNodes` properties
   - `NodeFilter` constants for tree walker
   - XPath generation capabilities

2. **Bundle Size Constraints:**
   - Used in both browser and Node.js environments
   - Part of a published npm package
   - Need minimal impact on browser bundle size

3. **Performance Requirements:**
   - Processing potentially large HTML documents
   - Real-time evaluation in browser environment
   - Used for academic/research purposes

## Library Comparison

### 1. **linkedom**
- **Browser/Node.js Compatibility:** ✅ Works in both environments
- **Bundle Size:** ~180KB minified
- **Performance:** Very fast, optimized for server-side
- **API Compatibility:** ✅ Full DOM Level 4 API including DOMParser
- **Maintenance:** ✅ Actively maintained by WebReflection
- **TypeScript:** ✅ Built-in types
- **Tree Walker Support:** ✅ Yes
- **Pros:** 
  - Closest to native DOM API
  - Excellent performance
  - Full spec compliance
- **Cons:**
  - Larger bundle size
  - May be overkill for simple parsing

### 2. **happy-dom**
- **Browser/Node.js Compatibility:** ✅ Works in both
- **Bundle Size:** ~200KB minified
- **Performance:** Good, optimized for testing
- **API Compatibility:** ✅ Full DOM API including DOMParser
- **Maintenance:** ✅ Very actively maintained
- **TypeScript:** ✅ Written in TypeScript
- **Tree Walker Support:** ✅ Yes
- **Pros:**
  - Excellent API coverage
  - Great for testing environments
  - Good documentation
- **Cons:**
  - Larger bundle size
  - More focused on testing use cases

### 3. **parse5**
- **Browser/Node.js Compatibility:** ✅ Works in both
- **Bundle Size:** ~90KB minified
- **Performance:** Excellent HTML5 parser
- **API Compatibility:** ❌ No DOM API, only AST
- **Maintenance:** ✅ Actively maintained
- **TypeScript:** ✅ Built-in types
- **Tree Walker Support:** ❌ No (AST only)
- **Pros:**
  - Smaller size
  - Very fast parsing
  - HTML5 spec compliant
- **Cons:**
  - No DOM API - would require significant refactoring
  - Need additional adapter for DOM-like interface

### 4. **html-dom-parser**
- **Browser/Node.js Compatibility:** ✅ Works in both
- **Bundle Size:** ~45KB minified
- **Performance:** Good
- **API Compatibility:** ⚠️ Limited DOM API
- **Maintenance:** ✅ Maintained
- **TypeScript:** ✅ Types available
- **Tree Walker Support:** ❌ No
- **Pros:**
  - Small bundle size
  - Simple API
- **Cons:**
  - Limited DOM API support
  - Would require significant code changes

### 5. **jsdom-global**
- **Browser/Node.js Compatibility:** ❌ Node.js only
- **Bundle Size:** N/A (Node only)
- **Performance:** Slower
- **API Compatibility:** ✅ Full DOM API
- **Maintenance:** ⚠️ Wrapper around jsdom
- **TypeScript:** ✅ Via jsdom
- **Tree Walker Support:** ✅ Yes
- **Pros:**
  - Full DOM compliance
- **Cons:**
  - Node.js only - not suitable for browser

### 6. **domino**
- **Browser/Node.js Compatibility:** ⚠️ Primarily Node.js
- **Bundle Size:** ~150KB minified
- **Performance:** Good
- **API Compatibility:** ✅ Good DOM API coverage
- **Maintenance:** ⚠️ Less active maintenance
- **TypeScript:** ⚠️ Community types
- **Tree Walker Support:** ✅ Yes
- **Pros:**
  - Good DOM API coverage
  - Lighter than jsdom
- **Cons:**
  - Less actively maintained
  - Browser support is secondary

### 7. **Basic DOM Shim Approach**
- Create a minimal shim that uses native DOMParser in browser and linkedom/happy-dom in Node.js
- **Bundle Size:** ~5KB for shim + 0 in browser
- **Performance:** Native in browser
- **API Compatibility:** ✅ Full native API in browser
- **Maintenance:** Self-maintained
- **TypeScript:** ✅ Native types
- **Pros:**
  - Zero overhead in browser
  - Full native performance
- **Cons:**
  - Requires maintaining shim code
  - Different implementations in each environment

## Recommendation

Based on the analysis and your specific requirements, I recommend a **hybrid approach using a DOM shim**:

### Primary Recommendation: DOM Shim with linkedom for Node.js

```typescript
// domParser.ts - Universal DOM parser shim
export function createDOMParser(): {
  parseFromString: (html: string, type: string) => Document;
} {
  // Browser environment
  if (typeof window !== 'undefined' && window.DOMParser) {
    return new DOMParser();
  }
  
  // Node.js environment
  const { DOMParser } = await import('linkedom');
  return new DOMParser();
}

// Export other DOM utilities as needed
export async function getDocument(): Promise<Document> {
  if (typeof window !== 'undefined') {
    return window.document;
  }
  
  const { parseHTML } = await import('linkedom');
  return parseHTML('<!DOCTYPE html><html><head></head><body></body></html>');
}
```

### Benefits:
1. **Zero bundle overhead in browser** - Uses native APIs
2. **Full DOM compatibility in Node.js** via linkedom
3. **No code changes required** - Same API surface
4. **Optimal performance** - Native in browser, fast in Node.js
5. **TypeScript friendly** - Uses native DOM types

### Alternative: If uniform implementation is required

Use **linkedom** across both environments:
- Pros: Consistent behavior, full API support
- Cons: 180KB bundle size impact
- Best for: When absolute consistency is more important than bundle size

### Implementation Strategy:

1. Create a `dom-utils` module that exports unified DOM utilities
2. Use dynamic imports for Node.js-specific code
3. Configure build tools to tree-shake Node.js code in browser builds
4. Add linkedom as an optional peer dependency

This approach gives you the best of both worlds: native performance in browsers and full compatibility in Node.js with minimal refactoring of existing code.