use std::cmp::min;
use wasm_bindgen::prelude::*;

// Function to calculate Levenshtein distance between two strings
#[wasm_bindgen]
pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.chars().count();
    let len2 = s2.chars().count();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut d: Vec<Vec<usize>> = vec![vec![0; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        d[i][0] = i;
    }
    for j in 0..=len2 {
        d[0][j] = j;
    }

    for i in 1..=len1 {
        let char1 = s1.chars().nth(i - 1).unwrap();
        for j in 1..=len2 {
            let char2 = s2.chars().nth(j - 1).unwrap();
            let cost = if char1 == char2 { 0 } else { 1 };
            d[i][j] = min(
                d[i - 1][j] + 1, // Deletion
                min(
                    d[i][j - 1] + 1,        // Insertion
                    d[i - 1][j - 1] + cost, // Substitution
                ),
            );
        }
    }

    d[len1][len2]
}

// Function to calculate normalized edit distance, exposed to Wasm
#[wasm_bindgen]
pub fn get_normalized_edit_distance_wasm(s1: &str, s2: &str) -> f64 {
    let len1 = s1.chars().count() as f64;
    let len2 = s2.chars().count() as f64;

    if len1 == 0.0 && len2 == 0.0 {
        return 0.0;
    }
    if len1 == 0.0 || len2 == 0.0 {
        return 1.0; // Or handle as per original logic for highly dissimilar
    }

    // As per original JS: if len1 > 2 * len2 || len2 > 2 * len1, return 1.0
    // Note: The JS version uses string length (bytes), chars().count() is more accurate for Unicode.
    // For direct porting, consider s1.len() and s2.len() if byte length is intended.
    // Using char count here as it's generally more robust for string comparisons.
    if len1 > 2.0 * len2 || len2 > 2.0 * len1 {
        return 1.0; // Consider highly dissimilar
    }

    let distance = levenshtein_distance(s1, s2) as f64;

    // Original normalization: distance / max(len1, len2)
    // The provided JS code does not explicitly show the normalization factor in getNormalizedEditDistance
    // but `editDistance` usually implies it would be normalized against the length of the longer string or sum of lengths.
    // The JS function `getNormalizedEditDistance` just returns `editDistance(s1, s2)` without dividing.
    // The paper this is likely based on (MDR) uses: dist / max(|s1|,|s2|)
    // However, the provided TypeScript code directly returns `distance` from `editDistance(s1, s2)`
    // and `editDistance` calculates `distance / Math.max(1,slen,tlen)`
    // Let's replicate the `editDistance` normalization logic from the original paper/common practice for robustness.
    // The provided `editDistance` in JS actually seems to be: distance / (s1.length + s2.length)
    // Let's re-check: the user's provided `editDistance` is not shown, but `getNormalizedEditDistance` returns `distance`
    // which *is* the editDistance, normalized as per a typical Levenshtein / (max_len).
    // The JS `editDistance` function is not visible, but `getNormalizedEditDistance` implies it's already normalized.
    // The current JS `getNormalizedEditDistance` *returns* `editDistance(s1,s2)`. Let's assume `editDistance` in JS already normalizes.
    // Ok, looking at the `editDistance` import, it's likely a library function.
    // A common normalization is `distance / max(len1, len2)`.
    // The JS `getNormalizedEditDistance` returns the raw distance and then compares it. It doesn't normalize itself.
    // It returns `distance` directly.

    // The TypeScript `getNormalizedEditDistance` returns `editDistance(s1, s2)`. It does not perform normalization itself.
    // It appears the `editDistance` function (imported from `@/lib/utils/editDistance`) is expected to return a normalized value, or the threshold T implicitly handles unnormalized distances.
    // Let's assume for now that the external `editDistance` function returns an unnormalized distance, and the comparison with T handles it.
    // So, this Wasm function should also return an unnormalized distance to match the current TS `getNormalizedEditDistance` behavior.
    // Re-reading the TS: `const distance = editDistance(s1, s2); return distance;`.
    // This means the threshold T is applied to the raw edit distance.
    // So, this Wasm function should return the raw Levenshtein distance.

    // Re-evaluating: The TS function is named `getNormalizedEditDistance`. It *must* return a normalized value.
    // The current TS code is: `const distance = editDistance(s1, s2); return distance;`
    // This implies `editDistance(s1, s2)` ITSELF returns a normalized distance.
    // Typical normalization is `lev_distance / max(len1, len2)`. Let's implement that.
    if len1 == 0.0 && len2 == 0.0 {
        // Should have been caught by earlier check, but for safety.
        return 0.0;
    }
    if len1 == 0.0 || len2 == 0.0 {
        // Only one is zero
        return 1.0;
    }

    distance / len1.max(len2)
}
