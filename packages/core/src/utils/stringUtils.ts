/**
 * Finds the longest common subsequence between two strings
 * @param s1 First string
 * @param s2 Second string
 * @returns Length of the longest common subsequence
 */
export function longestCommonSequence(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Build LCS matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculates normalized edit distance between two strings using LCS
 * @param s1 First string
 * @param s2 Second string
 * @returns Normalized edit distance between 0 and 1
 */
export function editDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  // Early return for significantly different length strings
  if (Math.abs(len1 - len2) > Math.max(len1, len2) / 2) {
    return 1.0;
  }

  const lcsLength = longestCommonSequence(s1, s2);
  const totalOperations = (len1 + len2) - (2 * lcsLength);
  
  // Normalize by average length of strings
  return totalOperations / ((len1 + len2) / 2);
} 