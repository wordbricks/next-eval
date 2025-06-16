import { removeCommentScriptStyleFromHTML } from "@wordbricks/next-eval/html/utils/removeCommentScriptStyleFromHTML";
import type { TagNode } from "@wordbricks/next-eval/shared/interfaces/TagNode";
import { buildTagTree } from "@wordbricks/next-eval/shared/utils/buildTagTree";
import { parse } from "node-html-parser";

// MDR (Mining Data Region) constants
export const MDR_K = 10; // Maximum length of a data region pattern
export const MDR_T = 0.3; // Similarity threshold for data region detection

type DataRegion = [number, number, number];
type DataRecord = TagNode | TagNode[];
const nodeDataRegions = new Map<TagNode, DataRegion[]>();

// Import WASM loader utilities
import {
  getWasmModule,
  initializeWasm,
  runRustMDR,
} from "@/lib/utils/wasmLoader";

function getChildren(node: TagNode): TagNode[] {
  return node.children || [];
}

function getNodeListSize(nodes: TagNode[]): number {
  return nodes.length;
}

function flattenSubtree(node: TagNode): string {
  if (node.tag === "text" && node.rawText && node.rawText.trim() !== "") {
    return ""; // Ignore text content for structural comparison
  }
  let result = `<${node.tag}>`;
  for (const child of getChildren(node)) {
    result += flattenSubtree(child);
  }
  if (node.tag !== "text") {
    result += `</${node.tag}>`;
  }
  return result;
}

function flattenNodeSequence(nodes: TagNode[]): string {
  return nodes.map(flattenSubtree).join("");
}

async function getNormalizedEditDistance(
  nodeSeq1: TagNode[],
  nodeSeq2: TagNode[],
): Promise<number> {
  await initializeWasm();
  const wasmModule = getWasmModule();

  const s1 = flattenNodeSequence(nodeSeq1);
  const s2 = flattenNodeSequence(nodeSeq2);
  const len1Bytes = s1.length;
  const len2Bytes = s2.length;

  if (len1Bytes > 2 * len2Bytes || len2Bytes > 2 * len1Bytes) {
    return 1.0; // Consider highly dissimilar
  }

  // Call the Wasm function
  return wasmModule.get_normalized_edit_distance_wasm(s1, s2);
}

async function areSiblingsSimilar(
  siblings: TagNode[],
  T: number,
): Promise<boolean> {
  if (siblings.length < 2) {
    return true; // No comparison needed for 0 or 1 sibling
  }
  for (let i = 0; i < siblings.length - 1; i++) {
    for (let j = i + 1; j < siblings.length; j++) {
      if ((await getNormalizedEditDistance([siblings[i]], [siblings[j]])) > T) {
        return false;
      }
    }
  }
  return true;
}

async function IdentDRs(
  startChildIndex: number,
  children: TagNode[],
  K: number,
  T: number,
): Promise<DataRegion[]> {
  const identifiedRegions: DataRegion[] = [];
  const n = getNodeListSize(children);
  let currentMaxDR: DataRegion | null = null;

  for (let gnLength = 1; gnLength <= K; gnLength++) {
    for (
      let startIdx = startChildIndex;
      startIdx <= startChildIndex + gnLength - 1 && startIdx < n;
      startIdx++
    ) {
      let currentDR: DataRegion | null = null;
      let isContinuingRegion = false;

      for (
        let checkIdx = startIdx;
        checkIdx + 2 * gnLength <= n;
        checkIdx += gnLength
      ) {
        const gn1 = children.slice(checkIdx, checkIdx + gnLength);
        const gn2 = children.slice(
          checkIdx + gnLength,
          checkIdx + 2 * gnLength,
        );

        const distance = await getNormalizedEditDistance(gn1, gn2);

        if (distance <= T) {
          if (!isContinuingRegion) {
            currentDR = [gnLength, checkIdx, 2 * gnLength];
            isContinuingRegion = true;
          } else if (currentDR) {
            currentDR[2] += gnLength;
          }
        } else {
          isContinuingRegion = false;
          if (currentDR) break;
        }
      }

      if (currentDR) {
        if (
          currentDR &&
          (!currentMaxDR || currentDR[2] > currentMaxDR[2]) &&
          (!currentMaxDR ||
            currentMaxDR[1] === 0 ||
            currentDR[1] <= currentMaxDR[1])
        ) {
          currentMaxDR = [...currentDR];
        } else if (
          currentDR &&
          currentMaxDR &&
          currentDR[2] === currentMaxDR[2] &&
          currentDR[1] === currentMaxDR[1] &&
          currentDR[0] < currentMaxDR[0]
        ) {
          currentMaxDR = [...currentDR];
        }
      }
    }
  }

  if (currentMaxDR) {
    identifiedRegions.push(currentMaxDR);
    const nextStartIndex = currentMaxDR[1] + currentMaxDR[2];

    if (nextStartIndex < n) {
      identifiedRegions.push(
        ...(await IdentDRs(nextStartIndex, children, K, T)),
      );
    }
  }
  return identifiedRegions;
}

function UnCoveredDRs(
  parentNode: TagNode,
  childNode: TagNode,
  childIndex: number,
): DataRegion[] {
  const parentDRs = nodeDataRegions.get(parentNode) || [];
  const childDRs = nodeDataRegions.get(childNode) || [];

  for (const dr of parentDRs) {
    const startIdx = dr[1];
    const nodeCount = dr[2];
    const endIdx = startIdx + nodeCount - 1;
    if (childIndex >= startIdx && childIndex <= endIdx) {
      return [];
    }
  }
  return childDRs;
}

async function findDRsRecursive(
  node: TagNode,
  K: number,
  T: number,
  depth = 0,
): Promise<void> {
  nodeDataRegions.set(node, []);
  let hasGrandchildren = false;
  if (getChildren(node).length > 0) {
    for (const child of getChildren(node)) {
      if (getChildren(child).length > 0) {
        hasGrandchildren = true;
        break;
      }
    }
  }

  let nodeDRs: DataRegion[] = [];
  if (hasGrandchildren) {
    const children = getChildren(node);
    if (getNodeListSize(children) >= 2) {
      nodeDRs = await IdentDRs(0, children, K, T);

      nodeDataRegions.set(node, nodeDRs);
    }
  }

  let tempDRs: DataRegion[] = [];
  const children = getChildren(node);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    await findDRsRecursive(child, K, T, depth + 1);
    const uncoveredChildDRs = UnCoveredDRs(node, child, i);
    tempDRs = tempDRs.concat(uncoveredChildDRs);
  }

  const finalDRs = (nodeDataRegions.get(node) || []).concat(tempDRs);

  nodeDataRegions.set(node, finalDRs);
}

async function runMDRAlgorithm(
  rootNode: TagNode,
  K: number,
  T: number,
): Promise<Map<TagNode, DataRegion[]>> {
  nodeDataRegions.clear();
  await findDRsRecursive(rootNode, K, T);

  const finalRegionsMap = new Map<TagNode, DataRegion[]>();
  for (const [node, drs] of nodeDataRegions.entries()) {
    if (drs && drs.length > 0) {
      finalRegionsMap.set(node, drs);
    }
  }
  return finalRegionsMap;
}

async function findRecords1(G: TagNode, T: number): Promise<TagNode[]> {
  const children = getChildren(G);
  const isTableRow = G.tag === "tr";
  const childrenAreSimilar = await areSiblingsSimilar(children, T);

  if (children.length > 0 && childrenAreSimilar && !isTableRow) {
    return children;
  }
  return [G];
}

// --- Figure 15: FindRecords-n ---
async function findRecordsN(G: TagNode[], T: number): Promise<DataRecord[]> {
  if (G.length === 0) return [];
  const n = G.length;
  let childrenAreSimilarWithinComponents = true;
  let sameNumberOfChildren = true;
  const firstNodeChildrenCount = getChildren(G[0]).length;

  for (const componentNode of G) {
    const children = getChildren(componentNode);
    if (children.length !== firstNodeChildrenCount) {
      sameNumberOfChildren = false;
      break;
    }
    if (!(await areSiblingsSimilar(children, T))) {
      childrenAreSimilarWithinComponents = false;
      break;
    }
  }

  if (
    childrenAreSimilarWithinComponents &&
    sameNumberOfChildren &&
    firstNodeChildrenCount > 0
  ) {
    const records: TagNode[][] = [];
    for (let i = 0; i < firstNodeChildrenCount; i++) {
      const recordGroup: TagNode[] = [];
      for (let j = 0; j < n; j++) {
        // Safety check for child existence
        const compChildren = getChildren(G[j]);
        if (i < compChildren.length) {
          recordGroup.push(compChildren[i]);
        }
      }
      if (recordGroup.length > 0) {
        records.push(recordGroup);
      }
    }
    return records;
  }
  return [G];
}

// --- Helper for Adjacent Region Merging ---
async function wouldProduceNonContiguous(
  G: TagNode[],
  T: number,
): Promise<boolean> {
  if (G.length <= 1) return false;
  let childrenAreSimilarWithinComponents = true;
  let sameNumberOfChildren = true;
  const firstNodeChildrenCount = getChildren(G[0]).length;
  if (firstNodeChildrenCount === 0) return false;

  for (const componentNode of G) {
    const children = getChildren(componentNode);
    if (children.length !== firstNodeChildrenCount) {
      sameNumberOfChildren = false;
      break;
    }
    if (!(await areSiblingsSimilar(children, T))) {
      childrenAreSimilarWithinComponents = false;
      break;
    }
  }
  return childrenAreSimilarWithinComponents && sameNumberOfChildren;
}

// --- Section 3.3 Post-processing (Adjacent Region Merging) & Record Identification ---
async function identifyAllDataRecords(
  regionsMap: Map<TagNode, DataRegion[]>,
  T: number,
): Promise<DataRecord[]> {
  const allRecords: DataRecord[] = [];
  const processedRegionKeys = new Set<string>();

  for (const [parentNode, regions] of regionsMap.entries()) {
    const children = getChildren(parentNode);
    const sortedRegions = [...regions].sort((a, b) => a[1] - b[1]);

    for (
      let regionIndex = 0;
      regionIndex < sortedRegions.length;
      regionIndex++
    ) {
      const region = sortedRegions[regionIndex];
      const [gnLength, startIdx, nodeCount] = region;
      const numGNs = nodeCount / gnLength;
      const regionKey = `${parentNode.tag}-${startIdx}`;

      if (processedRegionKeys.has(regionKey)) continue;

      let merged = false;
      if (gnLength > 1) {
        const nextRegionIndex = regionIndex + 1;
        if (nextRegionIndex < sortedRegions.length) {
          const nextRegion = sortedRegions[nextRegionIndex];
          const [nextGnLength, nextStartIdx] = nextRegion;

          if (
            startIdx + nodeCount === nextStartIdx &&
            gnLength === nextGnLength
          ) {
            const currentGNs = children.slice(startIdx, startIdx + gnLength);
            const nextGNs = children.slice(
              nextStartIdx,
              nextStartIdx + nextGnLength,
            );

            if (currentGNs.length > 0 && nextGNs.length > 0) {
              if ((await getNormalizedEditDistance(currentGNs, nextGNs)) > T) {
                if (
                  (await wouldProduceNonContiguous(currentGNs, T)) &&
                  (await wouldProduceNonContiguous(nextGNs, T))
                ) {
                  merged = true;
                  const mergedRecordsNonContiguous: TagNode[][] = [];
                  const components = [...currentGNs, ...nextGNs];
                  const numComponents = components.length;
                  if (numComponents > 0) {
                    const childCount = getChildren(components[0]).length;
                    for (let cIdx = 0; cIdx < childCount; cIdx++) {
                      const recordGroup: TagNode[] = [];
                      for (
                        let compIdx = 0;
                        compIdx < numComponents;
                        compIdx++
                      ) {
                        const compChildren = getChildren(components[compIdx]);
                        if (cIdx < compChildren.length) {
                          recordGroup.push(compChildren[cIdx]);
                        } else {
                          console.warn(
                            `Merge warning: Inconsistent child count at child index ${cIdx} for component ${compIdx}`,
                          );
                        }
                      }
                      if (recordGroup.length > 0) {
                        mergedRecordsNonContiguous.push(recordGroup);
                      }
                    }
                  }
                  allRecords.push(...mergedRecordsNonContiguous);
                  processedRegionKeys.add(`${parentNode.tag}-${nextStartIdx}`);
                }
              }
            }
          }
        }
      }

      if (merged) {
        processedRegionKeys.add(regionKey);
        continue;
      }

      // Standard Identification
      for (let i = 0; i < numGNs; i++) {
        const gnStartIndex = startIdx + i * gnLength;
        const generalizedNodeComponents = children.slice(
          gnStartIndex,
          gnStartIndex + gnLength,
        );
        if (generalizedNodeComponents.length === 0) continue;

        const identifiedRecords: DataRecord[] =
          gnLength === 1
            ? await findRecords1(generalizedNodeComponents[0], T)
            : await findRecordsN(generalizedNodeComponents, T);
        allRecords.push(...identifiedRecords);
      }
      processedRegionKeys.add(regionKey);
    }
  }
  return allRecords;
}

// --- Section 3.4 Post-processing (Orphan Records) ---
async function findOrphanRecords(
  regionsMap: Map<TagNode, DataRegion[]>,
  T: number,
): Promise<Set<TagNode>> {
  const foundOrphans = new Set<TagNode>();

  for (const [parentNode, regions] of regionsMap.entries()) {
    if (regions.length === 0) continue;

    const children = getChildren(parentNode);
    const n = children.length;
    const coveredIndices = new Set<number>();
    for (const region of regions) {
      const [gnLength, startIdx, nodeCount] = region;
      for (let i = 0; i < nodeCount; i++) {
        coveredIndices.add(startIdx + i);
      }
    }

    const orphanIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!coveredIndices.has(i)) {
        orphanIndices.push(i);
      }
    }
    if (orphanIndices.length === 0) continue;

    const [reprGnLength, reprStartIdx] = regions[0];
    const representativeGN = children.slice(
      reprStartIdx,
      reprStartIdx + reprGnLength,
    );
    if (representativeGN.length === 0) continue;
    const representativeRecordNode = representativeGN[0];
    const representativeRecordString = flattenSubtree(representativeRecordNode);
    if (representativeRecordString.length === 0) continue;

    for (const orphanIdx of orphanIndices) {
      const orphanNode = children[orphanIdx];
      for (const orphanChild of getChildren(orphanNode)) {
        const orphanChildString = flattenSubtree(orphanChild);
        if (orphanChildString.length > 0) {
          if (
            (await getNormalizedEditDistance(
              [orphanChild],
              [representativeRecordNode],
            )) <= T
          ) {
            foundOrphans.add(orphanChild);
          }
        }
      }
      const orphanNodeString = flattenSubtree(orphanNode);
      if (orphanNodeString.length > 0) {
        if (
          (await getNormalizedEditDistance(
            [orphanNode],
            [representativeRecordNode],
          )) <= T
        ) {
          foundOrphans.add(orphanNode);
        }
      }
    }
  }
  return foundOrphans;
}

export interface MDRResult {
  xpaths: string[][];
  records: DataRecord[];
  texts: string[];
}

// Helper function to extract texts from records
function extractTextsFromRecords(records: DataRecord[]): string[] {
  const texts: string[] = [];

  function extractTextFromNode(node: TagNode): void {
    // Check if the node itself has text
    if (node.rawText?.trim()) {
      texts.push(node.rawText);
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        extractTextFromNode(child);
      }
    }
  }

  for (const record of records) {
    if (Array.isArray(record)) {
      // Handle TagNode[] case
      for (const node of record) {
        if (node && typeof node === "object") {
          extractTextFromNode(node);
        }
      }
    } else if (record && typeof record === "object") {
      // Handle single TagNode case
      extractTextFromNode(record);
    }
  }

  return texts;
}

// New function that returns detailed results
export async function runMDRWithDetails(
  rawHtml: string,
  useRust = true,
  progressCallback?: (progress: number) => void,
): Promise<MDRResult> {
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);
  const rootDom = parse(cleanedHtml, {
    lowerCaseTagName: true,
    comment: false,
  });

  // Find the HTML element (could be the root or a child)
  const htmlElement =
    rootDom.querySelector("html") ||
    rootDom.childNodes.find((node: any) => node.tagName === "html");
  if (!htmlElement) {
    console.error("No HTML element found");
    return { xpaths: [], records: [], texts: [] };
  }

  const rootNode = buildTagTree(htmlElement);

  let finalRecords: DataRecord[] = [];

  // Use Rust implementation if requested
  if (useRust) {
    try {
      progressCallback?.(10); // Start progress
      const result = await runRustMDR(rootNode, MDR_K, MDR_T);
      progressCallback?.(90); // Almost done
      finalRecords = result.finalRecords;
    } catch (error) {
      console.error("Rust MDR failed, falling back to TypeScript:", error);
      // Fall through to TypeScript implementation
      useRust = false;
    }
  }

  if (!useRust) {
    // TypeScript implementation
    progressCallback?.(5); // Starting
    await initializeWasm();
    progressCallback?.(10); // WASM initialized

    // Step 1 & 2: Find Data Regions
    progressCallback?.(20); // Starting data region detection
    const allDataRegions = await runMDRAlgorithm(rootNode, MDR_K, MDR_T);
    progressCallback?.(50); // Data regions found

    // Step 3: Identify Records from Regions (with adjacent merging)
    progressCallback?.(60); // Identifying records
    const initialRecords = await identifyAllDataRecords(allDataRegions, MDR_T);
    progressCallback?.(80); // Records identified

    // Step 4: Find Orphan Records
    progressCallback?.(85); // Finding orphan records
    const orphanRecordsSet = await findOrphanRecords(allDataRegions, MDR_T);
    const orphanRecords = Array.from(orphanRecordsSet);
    progressCallback?.(90); // Orphan records found

    // Combine and Finalize Records
    finalRecords = [...initialRecords];
    const initialTagNodes = new Set(
      initialRecords.filter((r) => !Array.isArray(r)),
    );

    for (const orphan of orphanRecords) {
      if (
        orphan &&
        typeof orphan === "object" &&
        "xpath" in orphan &&
        !Array.isArray(orphan)
      ) {
        if (!initialTagNodes.has(orphan)) {
          finalRecords.push(orphan);
        }
      }
    }
  }

  // Convert to XPath arrays
  const xpaths: string[][] = finalRecords
    .map((record) => {
      if (Array.isArray(record)) {
        return record
          .filter((node) => node && typeof node === "object" && "xpath" in node)
          .map((node) => node.xpath);
      }
      if (record && typeof record === "object" && "xpath" in record) {
        return [record.xpath];
      }
      return [];
    })
    .filter((xpathArray) => xpathArray.length > 0);

  // Extract texts
  const texts = extractTextsFromRecords(finalRecords);

  progressCallback?.(100); // Complete

  return {
    xpaths,
    records: finalRecords,
    texts,
  };
}

export async function runMDR(
  rawHtml: string,
  useRust = true,
  progressCallback?: (progress: number) => void,
): Promise<string[][]> {
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);
  const rootDom = parse(cleanedHtml, {
    lowerCaseTagName: true,
    comment: false,
  });

  // Find the HTML element (could be the root or a child)
  const htmlElement =
    rootDom.querySelector("html") ||
    rootDom.childNodes.find((node: any) => node.tagName === "html");
  if (!htmlElement) {
    console.error("No HTML element found");
    return [];
  }

  const rootNode = buildTagTree(htmlElement);

  // Use Rust implementation if requested
  if (useRust) {
    try {
      progressCallback?.(10); // Start progress
      const { finalRecords } = await runRustMDR(rootNode, MDR_K, MDR_T);
      progressCallback?.(90); // Almost done

      // Convert to XPath arrays
      const finalRecordXpaths: string[][] = finalRecords
        .map((record) => {
          if (Array.isArray(record)) {
            return record
              .filter(
                (node) => node && typeof node === "object" && "xpath" in node,
              )
              .map((node) => node.xpath);
          }
          if (record && typeof record === "object" && "xpath" in record) {
            return [record.xpath];
          }
          return [];
        })
        .filter((xpathArray) => xpathArray.length > 0);

      progressCallback?.(100); // Complete
      return finalRecordXpaths;
    } catch (error) {
      console.error("Rust MDR failed, falling back to TypeScript:", error);
      // Fall through to TypeScript implementation
    }
  }

  // TypeScript implementation (fallback or when flag is disabled)
  progressCallback?.(5); // Starting
  await initializeWasm();
  progressCallback?.(10); // WASM initialized

  // Step 1 & 2: Find Data Regions
  progressCallback?.(20); // Starting data region detection
  const allDataRegions = await runMDRAlgorithm(rootNode, MDR_K, MDR_T);
  progressCallback?.(50); // Data regions found
  // Step 3: Identify Records from Regions (with adjacent merging)
  progressCallback?.(60); // Identifying records
  const initialRecords = await identifyAllDataRecords(allDataRegions, MDR_T);
  progressCallback?.(80); // Records identified
  // Step 4: Find Orphan Records
  progressCallback?.(85); // Finding orphan records
  const orphanRecordsSet = await findOrphanRecords(allDataRegions, MDR_T);
  const orphanRecords = Array.from(orphanRecordsSet);
  progressCallback?.(90); // Orphan records found

  // Combine and Finalize Records
  const finalRecords: DataRecord[] = [...initialRecords];
  const initialTagNodes = new Set(
    initialRecords.filter((r) => !Array.isArray(r)),
  );
  let uniqueOrphansAdded = 0;
  for (const orphan of orphanRecords) {
    if (
      orphan &&
      typeof orphan === "object" &&
      "xpath" in orphan &&
      !Array.isArray(orphan)
    ) {
      if (!initialTagNodes.has(orphan)) {
        finalRecords.push(orphan);
        uniqueOrphansAdded++;
      }
    }
  }

  if (finalRecords.length === 0) {
    return [];
  }
  const finalRecordXpaths: string[][] = finalRecords
    .map((record) => {
      if (Array.isArray(record)) {
        // Handle TagNode[] case (including potentially empty arrays or non-contiguous results)
        // We map each item, assuming it's a TagNode, filtering out any potential invalid entries just in case.
        return record
          .filter((node) => node && typeof node === "object" && "xpath" in node)
          .map((node) => node.xpath);
      }
      if (record && typeof record === "object" && "xpath" in record) {
        // Handle single TagNode case
        return [record.xpath];
      }
      // Handle potential invalid entries in finalRecords
      //console.warn("Skipping invalid record entry during XPath extraction:", record);
      return []; // Return empty array for invalid entries
    })
    .filter((xpathArray) => xpathArray.length > 0); // Filter out records that became empty

  progressCallback?.(100); // Complete
  return finalRecordXpaths;
}
