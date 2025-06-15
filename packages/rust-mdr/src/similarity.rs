use crate::tree_utils::flatten_subtree;
use crate::types::TagNodeRef;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::rc::Rc;

/// Global memo: (ptr_a, ptr_b) → distance
/// We store the lower pointer first so (a,b) == (b,a).
pub(crate) static NODE_DIST_CACHE: Lazy<DashMap<(usize, usize), f32>> =
    Lazy::new(|| DashMap::with_capacity(1_024));

/// O(min(m,n))-memory LCS implementation using two rolling rows.
fn longest_common_subsequence(s1: &[u8], s2: &[u8]) -> usize {
    // Early-outs
    if s1.is_empty() || s2.is_empty() {
        return 0;
    }

    // Always iterate over the longer string row-by-row to minimise the buffer.
    let (longer, shorter) = if s1.len() >= s2.len() {
        (s1, s2)
    } else {
        (s2, s1)
    };

    let n = shorter.len();
    let mut prev_row = vec![0usize; n + 1];
    let mut curr_row = vec![0usize; n + 1];

    for &c_long in longer {
        for (j, &c_short) in shorter.iter().enumerate() {
            curr_row[j + 1] = if c_long == c_short {
                prev_row[j] + 1
            } else {
                prev_row[j + 1].max(curr_row[j])
            };
        }
        // Re-use the buffers instead of reallocating.
        std::mem::swap(&mut prev_row, &mut curr_row);
    }

    prev_row[n]
}

/// Calculates normalized edit distance between two strings using LCS
/// Returns a value between 0.0 and 1.0, where 0.0 means identical and 1.0 means completely different
pub fn edit_distance(s1: &str, s2: &str) -> f32 {
    let len1 = s1.len();
    let len2 = s2.len();

    // Handle zero-length strings to avoid divide-by-zero
    if len1 == 0 && len2 == 0 {
        return 0.0;
    }
    if len1 == 0 || len2 == 0 {
        return 1.0;
    }

    // Early return for significantly different length strings
    if (len1 as i32 - len2 as i32).abs() > (len1.max(len2) / 2) as i32 {
        return 1.0;
    }

    let lcs_length = longest_common_subsequence(s1.as_bytes(), s2.as_bytes());
    let total_operations = len1 + len2 - 2 * lcs_length;

    // Normalize by max length to ensure result is in [0, 1]
    total_operations as f32 / (len1.max(len2) as f32)
}

/// Returns normalized edit distance between two nodes
pub fn normalized_edit_distance(a: &TagNodeRef, b: &TagNodeRef) -> f32 {
    // --- fast path: cached? ---------------------------------------------
    let pa = Rc::as_ptr(a) as usize;
    let pb = Rc::as_ptr(b) as usize;
    let key = if pa <= pb { (pa, pb) } else { (pb, pa) };
    if let Some(v) = NODE_DIST_CACHE.get(&key) {
        return *v;
    }

    // --- slow path: compute, store --------------------------------------
    let sa = flatten_subtree(a);
    let sb = flatten_subtree(b);
    let d = edit_distance(&sa, &sb);
    NODE_DIST_CACHE.insert(key, d);
    d
}

/// Checks if two sibling nodes are similar based on threshold
pub fn are_siblings_similar(a: &TagNodeRef, b: &TagNodeRef, t: f32) -> bool {
    normalized_edit_distance(a, b) <= t
}

/// Checks if all siblings in a list are similar to each other
pub fn are_all_siblings_similar(siblings: &[TagNodeRef], t: f32) -> bool {
    if siblings.len() < 2 {
        return true; // No comparison needed for 0 or 1 sibling
    }
    
    for i in 0..siblings.len() - 1 {
        for j in i + 1..siblings.len() {
            if normalized_edit_distance(&siblings[i], &siblings[j]) > t {
                return false;
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edit_distance_zero_length() {
        assert_eq!(edit_distance("", ""), 0.0);
        assert_eq!(edit_distance("", "abc"), 1.0);
        assert_eq!(edit_distance("abc", ""), 1.0);
    }
}

/// Flattens a sequence of nodes and returns the concatenated string
pub fn flatten_node_sequence(nodes: &[TagNodeRef]) -> String {
    nodes.iter()
        .map(|node| flatten_subtree(node))
        .collect::<Vec<_>>()
        .join("")
}

/// Returns normalized edit distance between two node sequences
pub fn get_normalized_edit_distance_sequences(
    node_seq1: &[TagNodeRef],
    node_seq2: &[TagNodeRef],
) -> f32 {
    let s1 = flatten_node_sequence(node_seq1);
    let s2 = flatten_node_sequence(node_seq2);
    let len1 = s1.len();
    let len2 = s2.len();

    if len1 > 2 * len2 || len2 > 2 * len1 {
        return 1.0; // Consider highly dissimilar
    }

    edit_distance(&s1, &s2)
}