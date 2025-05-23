import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

import { SYN_DATA_PATH, MDR_K, MDR_T } from "../constant";
import type { TagNode } from "../interfaces";
import {
  removeCommentScriptStyleFromHTML,
  buildTagTree,
  editDistance as calculateNormalizedEditDistance,
} from "../utils";

type DataRegion = [number, number, number];
type DataRecord = TagNode | TagNode[];
const nodeDataRegions = new Map<TagNode, DataRegion[]>();

function getChildren(node: TagNode): TagNode[] {
  return node.children || [];
}

function getNodeListSize(nodes: TagNode[]): number {
  return nodes.length;
}

function flattenSubtree(node: TagNode): string {
  if (node.tag === 'text' && node.rawText && node.rawText.trim() !== '') {
    return ''; // Ignore text content for structural comparison
  }
  let result = `<${node.tag}>`;
  for (const child of getChildren(node)) {
    result += flattenSubtree(child);
  }
  if (node.tag !== 'text') {
     result += `</${node.tag}>`;
  }
  return result;
}

function flattenNodeSequence(nodes: TagNode[]): string {
  return nodes.map(flattenSubtree).join('');
}

function getNormalizedEditDistance(nodeSeq1: TagNode[], nodeSeq2: TagNode[]): number {
    const s1 = flattenNodeSequence(nodeSeq1);
    const s2 = flattenNodeSequence(nodeSeq2);
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 > 2 * len2 || len2 > 2 * len1) {
        return 1.0; // Consider highly dissimilar
    }

    const distance = calculateNormalizedEditDistance(s1, s2);
    return distance;
}

function areSiblingsSimilar(siblings: TagNode[], T: number): boolean {
    if (siblings.length < 2) {
        return true; // No comparison needed for 0 or 1 sibling
    }
    for (let i = 0; i < siblings.length - 1; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
             if (getNormalizedEditDistance([siblings[i]], [siblings[j]]) > T) {
                 return false;
             }
        }
    }
    return true;
}

function IdentDRs(
    startChildIndex: number,
    children: TagNode[],
    K: number,
    T: number
): DataRegion[] {
    const identifiedRegions: DataRegion[] = [];
    const n = getNodeListSize(children);
    let currentMaxDR: DataRegion | null = null;

    for (let gnLength = 1; gnLength <= K; gnLength++) {
        for (let startIdx = startChildIndex; startIdx <= startChildIndex + gnLength -1 && startIdx < n ; startIdx++) {
            let currentDR: DataRegion | null = null;
            let isContinuingRegion = false;

            for (let checkIdx = startIdx; checkIdx + 2 * gnLength <= n; checkIdx += gnLength) {
                const gn1 = children.slice(checkIdx, checkIdx + gnLength);
                const gn2 = children.slice(checkIdx + gnLength, checkIdx + 2 * gnLength);

                if (getNormalizedEditDistance(gn1, gn2) <= T) {
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
                 if (currentDR &&
                     (!currentMaxDR || currentDR[2] > currentMaxDR[2]) &&
                     (!currentMaxDR || currentMaxDR[1] === 0 || currentDR[1] <= currentMaxDR[1]) ) {
                    currentMaxDR = [...currentDR];
                } else if (currentDR && currentMaxDR && currentDR[2] === currentMaxDR[2] && currentDR[1] === currentMaxDR[1] && currentDR[0] < currentMaxDR[0]){
                    currentMaxDR = [...currentDR];
                }
            }
        }
    }

    if (currentMaxDR) {
        identifiedRegions.push(currentMaxDR);
        const nextStartIndex = currentMaxDR[1] + currentMaxDR[2];
        if (nextStartIndex < n) {
            identifiedRegions.push(...IdentDRs(nextStartIndex, children, K, T));
        }
    }
    return identifiedRegions;
}

function UnCoveredDRs(parentNode: TagNode, childNode: TagNode, childIndex: number): DataRegion[] {
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

function findDRsRecursive(node: TagNode, K: number, T: number, depth: number = 0): void {
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
             nodeDRs = IdentDRs(0, children, K, T);
             nodeDataRegions.set(node, nodeDRs);
        }
    }

    let tempDRs: DataRegion[] = [];
    const children = getChildren(node);
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        findDRsRecursive(child, K, T, depth + 1);
        const uncoveredChildDRs = UnCoveredDRs(node, child, i);
        tempDRs = tempDRs.concat(uncoveredChildDRs);
    }

    const finalDRs = (nodeDataRegions.get(node) || []).concat(tempDRs);
    nodeDataRegions.set(node, finalDRs);
}

function runMDRAlgorithm(rootNode: TagNode, K: number, T: number): Map<TagNode, DataRegion[]> {
  nodeDataRegions.clear();
  findDRsRecursive(rootNode, K, T);

  const finalRegionsMap = new Map<TagNode, DataRegion[]>();
    nodeDataRegions.forEach((drs, node) => {
        if (drs && drs.length > 0) {
            finalRegionsMap.set(node, drs);
        }
    });
  return finalRegionsMap;
}

function findRecords1(G: TagNode, T: number): TagNode[] {
    const children = getChildren(G);
    const isTableRow = G.tag === 'tr';
    const childrenAreSimilar = areSiblingsSimilar(children, T);

    if (children.length > 0 && childrenAreSimilar && !isTableRow) {
         return children;
    } else {
        return [G];
    }
}

// --- Figure 15: FindRecords-n ---
function findRecordsN(G: TagNode[], T: number): DataRecord[] {
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
        if (!areSiblingsSimilar(children, T)) {
            childrenAreSimilarWithinComponents = false;
            break;
        }
    }

    if (childrenAreSimilarWithinComponents && sameNumberOfChildren && firstNodeChildrenCount > 0) {
        const records: TagNode[][] = [];
        for (let i = 0; i < firstNodeChildrenCount; i++) {
            const recordGroup: TagNode[] = [];
            for (let j = 0; j < n; j++) {
                 // Safety check for child existence
                 const compChildren = getChildren(G[j]);
                 if(i < compChildren.length){
                     recordGroup.push(compChildren[i]);
                 }
            }
            if (recordGroup.length > 0) {
                records.push(recordGroup);
            }
        }
        return records;
    } else {
        return [G];
    }
}

// --- Helper for Adjacent Region Merging ---
function wouldProduceNonContiguous(G: TagNode[], T: number): boolean {
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
         if (!areSiblingsSimilar(children, T)) {
             childrenAreSimilarWithinComponents = false;
             break;
         }
     }
     return childrenAreSimilarWithinComponents && sameNumberOfChildren;
}

// --- Section 3.3 Post-processing (Adjacent Region Merging) & Record Identification ---
function identifyAllDataRecords(
    regionsMap: Map<TagNode, DataRegion[]>,
    T: number
): DataRecord[] {
    const allRecords: DataRecord[] = [];
    const processedRegionKeys = new Set<string>();

    regionsMap.forEach((regions, parentNode) => {
        const children = getChildren(parentNode);
        const sortedRegions = [...regions].sort((a, b) => a[1] - b[1]);

        for (let regionIndex = 0; regionIndex < sortedRegions.length; regionIndex++) {
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

                    if (startIdx + nodeCount === nextStartIdx && gnLength === nextGnLength) {
                        const currentGNs = children.slice(startIdx, startIdx + gnLength);
                        const nextGNs = children.slice(nextStartIdx, nextStartIdx + nextGnLength);

                        if (currentGNs.length > 0 && nextGNs.length > 0) {
                            if (getNormalizedEditDistance(currentGNs, nextGNs) > T) {
                                if (wouldProduceNonContiguous(currentGNs, T) && wouldProduceNonContiguous(nextGNs, T)) {
                                    merged = true;
                                    const mergedRecordsNonContiguous: TagNode[][] = [];
                                    const components = [...currentGNs, ...nextGNs];
                                    const numComponents = components.length;
                                    if (numComponents > 0) {
                                        const childCount = getChildren(components[0]).length;
                                        for (let cIdx = 0; cIdx < childCount; cIdx++) {
                                            const recordGroup: TagNode[] = [];
                                            for (let compIdx = 0; compIdx < numComponents; compIdx++) {
                                                const compChildren = getChildren(components[compIdx]);
                                                if(cIdx < compChildren.length){
                                                    recordGroup.push(compChildren[cIdx]);
                                                } else {
                                                    console.warn(`Merge warning: Inconsistent child count at child index ${cIdx} for component ${compIdx}`);
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
                const generalizedNodeComponents = children.slice(gnStartIndex, gnStartIndex + gnLength);
                if (generalizedNodeComponents.length === 0) continue;

                let identifiedRecords: DataRecord[] = (gnLength === 1)
                   ? findRecords1(generalizedNodeComponents[0], T)
                   : findRecordsN(generalizedNodeComponents, T);
                allRecords.push(...identifiedRecords);
            }
            processedRegionKeys.add(regionKey);
        }
    });
    return allRecords;
}

// --- Section 3.4 Post-processing (Orphan Records) ---
function findOrphanRecords(
    regionsMap: Map<TagNode, DataRegion[]>,
    T: number
): Set<TagNode> {
    const foundOrphans = new Set<TagNode>();

    regionsMap.forEach((regions, parentNode) => {
        if (regions.length === 0) return;

        const children = getChildren(parentNode);
        const n = children.length;
        const coveredIndices = new Set<number>();
        regions.forEach(region => {
            const [gnLength, startIdx, nodeCount] = region;
            for (let i = 0; i < nodeCount; i++) {
                coveredIndices.add(startIdx + i);
            }
        });

        const orphanIndices: number[] = [];
        for (let i = 0; i < n; i++) {
            if (!coveredIndices.has(i)) {
                orphanIndices.push(i);
            }
        }
        if (orphanIndices.length === 0) return;

        const [reprGnLength, reprStartIdx] = regions[0];
        const representativeGN = children.slice(reprStartIdx, reprStartIdx + reprGnLength);
        if (representativeGN.length === 0) return;
        const representativeRecordNode = representativeGN[0]; // Use first node of first GN as representative
        const representativeRecordString = flattenSubtree(representativeRecordNode);
         if (representativeRecordString.length === 0) return; // Cannot compare against empty structure

        orphanIndices.forEach(orphanIdx => {
            const orphanNode = children[orphanIdx];
            // Compare children of orphan
            getChildren(orphanNode).forEach(orphanChild => {
                 const orphanChildString = flattenSubtree(orphanChild);
                 if (orphanChildString.length > 0) {
                    if (getNormalizedEditDistance([orphanChild], [representativeRecordNode]) <= T) {
                        foundOrphans.add(orphanChild);
                    }
                 }
            });
            // Compare the orphan node itself
            const orphanNodeString = flattenSubtree(orphanNode);
            if (orphanNodeString.length > 0) {
                if (getNormalizedEditDistance([orphanNode], [representativeRecordNode]) <= T) {
                    foundOrphans.add(orphanNode);
                }
            }
        });
    });
    return foundOrphans;
}

function runMDR(htmlPath: string, outputPath: string): void {
  const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
  const cleanedHtml = removeCommentScriptStyleFromHTML(rawHtml);
  const rootDom = parse(cleanedHtml, { lowerCaseTagName: true, comment: false });
  const rootNode = buildTagTree(rootDom.childNodes[0]);

  console.log(`\n--- Processing: ${path.basename(htmlPath)} ---`);

  // Step 1 & 2: Find Data Regions
  console.log(`Running MDR Algorithm (Steps 1 & 2)... K=${MDR_K}, T=${MDR_T}`);
  const allDataRegions = runMDRAlgorithm(rootNode, MDR_K, MDR_T);
  if (allDataRegions.size === 0) {
      console.log('No data regions found (Steps 1 & 2).');
  } else {
       console.log(`Found ${allDataRegions.size} nodes with data regions (Steps 1 & 2):`);
       allDataRegions.forEach((regions, parentNode) => {
           console.log(`  Node <${parentNode.tag}> has ${regions.length} region(s)`);
       });
   }

  // Step 3: Identify Records from Regions (with adjacent merging)
  console.log(`\nIdentifying Data Records (Step 3 + Adjacent Merging)... T=${MDR_T}`);
  const initialRecords = identifyAllDataRecords(allDataRegions, MDR_T);

  // Step 4: Find Orphan Records
  console.log(`\nFinding Orphan Records (Step 4)... T=${MDR_T}`);
  const orphanRecordsSet = findOrphanRecords(allDataRegions, MDR_T);
  const orphanRecords = Array.from(orphanRecordsSet);

  // Combine and Finalize Records
  const finalRecords: DataRecord[] = [...initialRecords];
  const initialTagNodes = new Set(initialRecords.filter(r => !Array.isArray(r)));
  let uniqueOrphansAdded = 0;
  orphanRecords.forEach(orphan => {
      // Ensure orphan is a single TagNode before checking existence and adding
      if (orphan && typeof orphan === 'object' && 'xpath' in orphan && !Array.isArray(orphan)) {
        if (!initialTagNodes.has(orphan)) {
            finalRecords.push(orphan);
            uniqueOrphansAdded++;
        }
      } else {
        // Handle cases where an orphan might unexpectedly be an array or invalid
        console.warn("Skipping potentially invalid orphan record:", orphan);
      }
  });

  // Log Final Results
   if (finalRecords.length === 0) {
      console.log('No data records identified after post-processing.');
  } else {
      console.log(`\nTotal Initial Records: ${initialRecords.length}, Orphans Found: ${orphanRecords.length}, Unique Orphans Added: ${uniqueOrphansAdded}`);
      console.log(`Identified ${finalRecords.length} Final Data Records (After Post-processing). Outputting as XPath arrays (string[][]):`);

      const finalRecordXpaths: string[][] = finalRecords.map(record => {
          if (Array.isArray(record)) {
              // Handle TagNode[] case (including potentially empty arrays or non-contiguous results)
              // We map each item, assuming it's a TagNode, filtering out any potential invalid entries just in case.
              return record.filter(node => node && typeof node === 'object' && 'xpath' in node).map(node => node.xpath);
          } else if (record && typeof record === 'object' && 'xpath' in record) {
              // Handle single TagNode case
              return [record.xpath];
          } else {
              // Handle potential invalid entries in finalRecords
               console.warn("Skipping invalid record entry during XPath extraction:", record);
               return []; // Return empty array for invalid entries
          }
      }).filter(xpathArray => xpathArray.length > 0); // Filter out records that became empty
      console.log(JSON.stringify(finalRecordXpaths, null, 2));

      // Save the results to the specified output path
      try {
        fs.writeFileSync(outputPath, JSON.stringify(finalRecordXpaths, null, 2), 'utf-8');
        console.log(`\nSaved identified record XPaths to: ${outputPath}`);
      } catch (error) {
        console.error(`Failed to save MDR results to ${outputPath}:`, error);
      }
  }
  console.log(`--- Finished: ${path.basename(htmlPath)} ---`);
}

const main = async () => {
  const slimDirPath = path.join(SYN_DATA_PATH, "slim");
  const mdrDirPath = path.join(SYN_DATA_PATH, "mdr");
  let processedCount = 0;
	for (let index = 1;index<=164;index++ ){
    const mdrPath = path.join(mdrDirPath, `${index}.json`);
		const slimPath = path.join(slimDirPath, `${index}.html`);
		if (fs.existsSync(slimPath)) {
			try {
				runMDR(slimPath, mdrPath);
        processedCount++;
			} catch (error) {
				console.error(`Error processing ${slimPath}:`, error);
			}
		} else {
			console.warn(`Cleaned HTML file not found for ${index}: ${slimPath}`);
		}
	}
	if (processedCount === 0) {
		console.log("No valid records with existing cleaned HTML found to process.");
	}
};

main().catch(error => {
	console.error("Error during main execution:", error);
});
