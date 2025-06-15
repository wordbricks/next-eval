use crate::similarity::get_normalized_edit_distance_sequences;
use crate::tree_utils::get_children;
use crate::types::{DataRegion, RegionsMapItem, TagNodeRef};
use indexmap::IndexMap;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

/// Identifies data regions in a list of children nodes
pub fn ident_drs(
    start_child_idx: usize,
    children: &[TagNodeRef],
    k: usize,
    t: f32,
) -> Vec<DataRegion> {
    let mut identified_regions: Vec<DataRegion> = Vec::new();
    let n = children.len();
    let mut current_max_dr: Option<DataRegion> = None;

    for gn_length in 1..=k {
        for start_idx in start_child_idx..=(start_child_idx + gn_length - 1) {
            if start_idx >= n {
                break;
            }

            let mut current_dr: Option<DataRegion> = None;
            let mut is_continuing_region = false;

            let mut check_idx = start_idx;
            while check_idx + 2 * gn_length <= n {
                let gn1 = &children[check_idx..check_idx + gn_length];
                let gn2 = &children[check_idx + gn_length..check_idx + 2 * gn_length];

                let distance = get_normalized_edit_distance_sequences(gn1, gn2);

                // Add small epsilon to handle floating point precision issues
                // matching TypeScript behavior where 0.30000001 > 0.3
                if distance <= t - 0.0000001 {
                    if !is_continuing_region {
                        current_dr = Some((gn_length, check_idx, 2 * gn_length));
                        is_continuing_region = true;
                    } else if let Some(ref mut dr) = current_dr {
                        dr.2 += gn_length;
                    }
                } else {
                    is_continuing_region = false;
                    if current_dr.is_some() {
                        break;
                    }
                }
                check_idx += gn_length;
            }

            if let Some(dr) = current_dr {
                // Match TypeScript logic EXACTLY with proper parentheses
                let should_update = if let Some(ref max_dr) = current_max_dr {
                    // First complex condition (matches TypeScript lines 128-134)
                    let cond1_part1 = dr.2 > max_dr.2; // currentDR[2] > currentMaxDR[2]
                    let cond1_part2 = max_dr.1 == 0 || dr.1 <= max_dr.1; // currentMaxDR[1] === 0 || currentDR[1] <= currentMaxDR[1]
                    let first_condition = cond1_part1 && cond1_part2;

                    // Second condition (matches TypeScript lines 135-143)
                    let second_condition = dr.2 == max_dr.2 && dr.1 == max_dr.1 && dr.0 < max_dr.0;

                    first_condition || second_condition
                } else {
                    // !currentMaxDR case
                    true
                };

                if should_update {
                    current_max_dr = Some(dr);
                }
            }
        }
    }

    if let Some(max_dr) = current_max_dr {
        identified_regions.push(max_dr);

        // Find additional regions outside the current max region
        let next_start_idx = max_dr.1 + max_dr.2;
        if next_start_idx < n {
            let additional_regions = ident_drs(next_start_idx, children, k, t);
            identified_regions.extend(additional_regions);
        }
    }

    identified_regions
}

/// Recursively finds data regions in the entire tree
pub fn find_drs_recursive(
    node: &TagNodeRef,
    k: usize,
    t: f32,
    depth: usize,
    node_regions_map: &mut IndexMap<String, Vec<DataRegion>>,
) {
    let children = get_children(node);

    // Initialize node regions to empty (matching TypeScript)
    node_regions_map.insert(node.xpath.clone(), Vec::new());

    // Check if node has grandchildren (TypeScript: hasGrandchildren)
    let mut has_grandchildren = false;
    for child in &children {
        if !get_children(child).is_empty() {
            has_grandchildren = true;
            break;
        }
    }

    // Only run MDR if node has grandchildren and at least 2 children
    let mut node_drs = Vec::new();
    if has_grandchildren && children.len() >= 2 {
        node_drs = ident_drs(0, &children, k, t);

        // Update map with found regions
        node_regions_map.insert(node.xpath.clone(), node_drs.clone());
    }

    // Process children recursively and collect uncovered regions
    let mut temp_drs = Vec::new();
    for (child_idx, child) in children.iter().enumerate() {
        // Recursive call
        find_drs_recursive(&child, k, t, depth + 1, node_regions_map);

        // Get uncovered child DRs (UnCoveredDRs function logic)
        let child_drs = node_regions_map
            .get(&child.xpath)
            .cloned()
            .unwrap_or_default();
        let mut is_covered = false;

        // Check if this child index is covered by any parent region
        for dr in &node_drs {
            let start_idx = dr.1;
            let node_count = dr.2;
            let end_idx = start_idx + node_count - 1;
            if child_idx >= start_idx && child_idx <= end_idx {
                is_covered = true;
                break;
            }
        }

        // If not covered, add child's regions to temp
        if !is_covered {
            temp_drs.extend(child_drs);
        }
    }

    // Combine node DRs with uncovered child DRs (matching TypeScript line 215)
    let mut final_drs = node_drs;
    final_drs.extend(temp_drs);

    // Always update the map with final regions (matching TypeScript line 216)
    node_regions_map.insert(node.xpath.clone(), final_drs);
}

/// Main MDR algorithm entry point
pub fn run_mdr_algorithm(root_node: &TagNodeRef, k: usize, t: f32) -> Vec<RegionsMapItem> {
    let mut node_regions_map = IndexMap::new();

    // Run the recursive algorithm to populate the map
    find_drs_recursive(root_node, k, t, 0, &mut node_regions_map);

    // Build output vector from the map (matching TypeScript runMDRAlgorithm)
    let mut all_regions = Vec::new();
    for (xpath, regions) in node_regions_map {
        if !regions.is_empty() {
            all_regions.push(RegionsMapItem {
                parent_xpath: xpath,
                regions,
            });
        }
    }

    all_regions
}

/// Converts the regions vector to a HashMap for easier access
pub fn regions_to_map(regions: &[RegionsMapItem]) -> IndexMap<String, Vec<DataRegion>> {
    let mut map = IndexMap::new();
    for item in regions {
        map.insert(item.parent_xpath.clone(), item.regions.clone());
    }
    map
}
