use crate::tree_utils::flatten_subtree;
use crate::types::TagNodeRef;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::sync::Arc;
use levenshtein::levenshtein;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

/// Global memo: (ptr_a, ptr_b) → distance
/// We store the lower pointer first so (a,b) == (b,a).
pub(crate) static NODE_DIST_CACHE: Lazy<DashMap<(usize, usize), f32>> =
    Lazy::new(|| DashMap::with_capacity(1_024));

/// Calculates normalized edit distance between two strings using Levenshtein
/// Returns a value between 0.0 and 1.0, where 0.0 means identical and 1.0 means completely different
pub fn edit_distance(s1: &str, s2: &str) -> f32 {
    let d = levenshtein(s1, s2) as f32;
    let n = s1.len().max(s2.len()) as f32;
    if n == 0.0 { 0.0 } else { d / n }
}

/// Returns normalized edit distance between two nodes
pub fn normalized_edit_distance(a: &TagNodeRef, b: &TagNodeRef) -> f32 {
    // --- fast path: cached? ---------------------------------------------
    let pa = Arc::as_ptr(a) as usize;
    let pb = Arc::as_ptr(b) as usize;
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
    
    #[cfg(feature = "parallel")]
    {
        siblings.par_iter().enumerate().all(|(i, a)| {
            siblings[i + 1..]
                .par_iter()
                .all(|b| normalized_edit_distance(a, b) <= t)
        })
    }
    #[cfg(not(feature = "parallel"))]
    {
        for i in 0..siblings.len() - 1 {
            for j in i + 1..siblings.len() {
                if normalized_edit_distance(&siblings[i], &siblings[j]) > t {
                    return false;
                }
            }
        }
        true
    }
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