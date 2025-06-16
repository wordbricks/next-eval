/**
 * Calculates the Jaccard similarity (Overlap score) between two records (sets of XPaths).
 * @param record1 - First set of XPaths.
 * @param record2 - Second set of XPaths.
 * @returns The Jaccard index.
 */
export const calculateOverlap = (
  record1: string[],
  record2: string[],
): number => {
  const set1 = new Set(record1);
  const set2 = new Set(record2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) {
    return 1; // Define overlap as 1 if both sets are empty
  }

  return intersection.size / union.size;
};
