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
            if current_max_dr.is_none() || dr.2 > current_max_dr.as_ref().unwrap().2 {
                if current_max_dr.is_none() 
                    || dr.0 * dr.2 > current_max_dr.as_ref().unwrap().0 * current_max_dr.as_ref().unwrap().2 {
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
    out: &mut Vec<RegionsMapItem>,
) {
    let children = get_children(node);
    
    if children.len() >= k {
        let regions = ident_drs(0, &children, k, t);
        if !regions.is_empty() {
            out.push(RegionsMapItem {
                parent_xpath: node.xpath.clone(),
                regions,
            });
        }
    }
    
    // Recursively process children
    for child in children {
        find_drs_recursive(&child, k, t, depth + 1, out);
    }
}

/// Main MDR algorithm entry point
pub fn run_mdr_algorithm(
    root_node: &TagNodeRef,
    k: usize,
    t: f32,
) -> Vec<RegionsMapItem> {
    let mut all_regions = Vec::new();
    find_drs_recursive(root_node, k, t, 0, &mut all_regions);
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