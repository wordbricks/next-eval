use crate::similarity::get_normalized_edit_distance_sequences;
use crate::tree_utils::get_children;
use crate::types::{DataRegion, RegionsMapItem, TagNodeRef};
use std::collections::HashMap;

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
        // Scan potential starting offsets in parallel – one window per iteration
        #[cfg(feature = "parallel")]
        let iter = (start_child_idx..=start_child_idx + gn_length - 1).into_par_iter();
        #[cfg(not(feature = "parallel"))]
        let iter = (start_child_idx..=start_child_idx + gn_length - 1).into_iter();

        let region_results: Vec<Option<DataRegion>> = iter.map(|start_idx| {
            if start_idx >= n {
                return None;
            }

            let mut current_dr: Option<DataRegion> = None;
            let mut is_continuing_region = false;

            let mut check_idx = start_idx;
            while check_idx + 2 * gn_length <= n {
                let gn1 = &children[check_idx..check_idx + gn_length];
                let gn2 = &children[check_idx + gn_length..check_idx + 2 * gn_length];

                if get_normalized_edit_distance_sequences(gn1, gn2) <= t {
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

            current_dr
        }).collect();

        // Find the best region from this gn_length
        for dr in region_results.into_iter().flatten() {
            if let Some(ref max_dr) = current_max_dr {
                // TypeScript condition 1: currentDR[2] > currentMaxDR[2] with start index check
                if dr.2 > max_dr.2 && (max_dr.1 == 0 || dr.1 <= max_dr.1) {
                    current_max_dr = Some(dr);
                }
                // TypeScript condition 2: equal node count but smaller gnLength
                else if dr.2 == max_dr.2 && dr.1 == max_dr.1 && dr.0 < max_dr.0 {
                    current_max_dr = Some(dr);
                }
            } else {
                current_max_dr = Some(dr);
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
    out: &mut Vec<RegionsMapItem>,
    node_regions_map: &mut HashMap<String, Vec<DataRegion>>,
) {
    let children = get_children(node);
    
    // Initialize node regions
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
        if !node_drs.is_empty() {
            node_regions_map.insert(node.xpath.clone(), node_drs.clone());
        }
    }
    
    // Process children and collect uncovered regions
    let mut temp_drs = Vec::new();
    for (child_idx, child) in children.iter().enumerate() {
        find_drs_recursive(&child, k, t, depth + 1, out, node_regions_map);
        
        // Get uncovered child DRs (similar to UnCoveredDRs function)
        let child_drs = node_regions_map.get(&child.xpath).cloned().unwrap_or_default();
        let mut is_covered = false;
        
        for dr in &node_drs {
            let start_idx = dr.1;
            let node_count = dr.2;
            let end_idx = start_idx + node_count - 1;
            if child_idx >= start_idx && child_idx <= end_idx {
                is_covered = true;
                break;
            }
        }
        
        if !is_covered {
            temp_drs.extend(child_drs);
        }
    }
    
    // Combine node DRs with uncovered child DRs
    let mut final_drs = node_drs;
    final_drs.extend(temp_drs);
    
    if !final_drs.is_empty() {
        node_regions_map.insert(node.xpath.clone(), final_drs.clone());
        out.push(RegionsMapItem {
            parent_xpath: node.xpath.clone(),
            regions: final_drs,
        });
    }
}

/// Main MDR algorithm entry point
pub fn run_mdr_algorithm(
    root_node: &TagNodeRef,
    k: usize,
    t: f32,
) -> Vec<RegionsMapItem> {
    let mut all_regions = Vec::new();
    let mut node_regions_map = HashMap::new();
    find_drs_recursive(root_node, k, t, 0, &mut all_regions, &mut node_regions_map);
    all_regions
}

/// Converts the regions vector to a HashMap for easier access
pub fn regions_to_map(regions: &[RegionsMapItem]) -> HashMap<String, Vec<DataRegion>> {
    let mut map = HashMap::new();
    for item in regions {
        map.insert(item.parent_xpath.clone(), item.regions.clone());
    }
    map
}