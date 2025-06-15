use crate::similarity::{are_all_siblings_similar, get_normalized_edit_distance_sequences};
use crate::tree_utils::{flatten_subtree, get_children, get_node_by_xpath};
use crate::types::{DataRecord, RegionsMapItem, TagNodeRef};
use std::collections::HashSet;

/// Find records for a single node (gnLength = 1)
pub fn find_records1(g: &TagNodeRef, t: f32) -> Vec<TagNodeRef> {
    let children = get_children(g);
    let is_table_row = g.tag_name == "tr";
    let children_are_similar = are_all_siblings_similar(&children, t);

    if !children.is_empty() && children_are_similar && !is_table_row {
        children
    } else {
        vec![g.clone()]
    }
}

/// Find records for multiple nodes (gnLength > 1)
pub fn find_records_n(g: &[TagNodeRef], t: f32) -> Vec<DataRecord> {
    if g.is_empty() {
        return vec![];
    }

    let n = g.len();
    let mut children_are_similar_within_components = true;
    let mut same_number_of_children = true;
    let first_node_children_count = get_children(&g[0]).len();

    for component_node in g {
        let children = get_children(component_node);
        if children.len() != first_node_children_count {
            same_number_of_children = false;
            break;
        }
        if !are_all_siblings_similar(&children, t) {
            children_are_similar_within_components = false;
            break;
        }
    }

    if children_are_similar_within_components && same_number_of_children && first_node_children_count > 0 {
        let mut records: Vec<DataRecord> = Vec::new();
        for i in 0..first_node_children_count {
            let mut record_group: Vec<TagNodeRef> = Vec::new();
            for j in 0..n {
                let comp_children = get_children(&g[j]);
                if i < comp_children.len() {
                    record_group.push(comp_children[i].clone());
                }
            }
            if !record_group.is_empty() {
                records.push(DataRecord::Multi(record_group));
            }
        }
        records
    } else {
        vec![DataRecord::Multi(g.to_vec())]
    }
}

/// Helper to check if merging would produce non-contiguous records
fn would_produce_non_contiguous(g: &[TagNodeRef], t: f32) -> bool {
    if g.len() <= 1 {
        return false;
    }

    let mut children_are_similar_within_components = true;
    let mut same_number_of_children = true;
    let first_node_children_count = get_children(&g[0]).len();
    
    if first_node_children_count == 0 {
        return false;
    }

    for component_node in g {
        let children = get_children(component_node);
        if children.len() != first_node_children_count {
            same_number_of_children = false;
            break;
        }
        if !are_all_siblings_similar(&children, t) {
            children_are_similar_within_components = false;
            break;
        }
    }

    children_are_similar_within_components && same_number_of_children
}

/// Identify all data records from regions map
pub fn identify_all_data_records(regions: &[RegionsMapItem], _t: f32) -> Vec<DataRecord> {
    let all_records: Vec<DataRecord> = Vec::new();
    let mut processed_region_keys: HashSet<String> = HashSet::new();

    for region_item in regions {
        let parent_xpath = &region_item.parent_xpath;
        let sorted_regions = {
            let mut regs = region_item.regions.clone();
            regs.sort_by_key(|r| r.1); // Sort by start index
            regs
        };

        // Need to get the parent node and its children
        // This requires access to the original tree - we'll need to pass it in
        // For now, we'll skip the actual implementation details that require tree access
        
        for (region_index, region) in sorted_regions.iter().enumerate() {
            let (gn_length, start_idx, node_count) = *region;
            let _num_gns = node_count / gn_length;
            let region_key = format!("{}-{}", parent_xpath, start_idx);

            if processed_region_keys.contains(&region_key) {
                continue;
            }

            let mut merged = false;

            // Adjacent region merging logic
            if gn_length > 1 && region_index + 1 < sorted_regions.len() {
                let next_region = &sorted_regions[region_index + 1];
                let (next_gn_length, next_start_idx, _) = *next_region;

                if start_idx + node_count == next_start_idx && gn_length == next_gn_length {
                    // Would need to check similarity and merge here
                    // Skipping implementation details that require tree access
                    merged = false; // Placeholder
                }
            }

            if merged {
                processed_region_keys.insert(region_key);
                continue;
            }

            // Standard identification would go here
            // This requires access to the actual nodes
            processed_region_keys.insert(region_key);
        }
    }

    all_records
}

/// Complete implementation that takes the tree root for node lookups
pub fn identify_all_data_records_with_tree(
    regions: &[RegionsMapItem],
    t: f32,
    root: &TagNodeRef,
) -> Vec<DataRecord> {
    let mut all_records: Vec<DataRecord> = Vec::new();
    let mut processed_region_keys: HashSet<String> = HashSet::new();

    for region_item in regions {
        let parent_xpath = &region_item.parent_xpath;
        let parent_node = match get_node_by_xpath(root, parent_xpath) {
            Some(node) => node,
            None => continue,
        };

        let children = get_children(&parent_node);
        let sorted_regions = {
            let mut regs = region_item.regions.clone();
            regs.sort_by_key(|r| r.1);
            regs
        };

        for (region_index, region) in sorted_regions.iter().enumerate() {
            let (gn_length, start_idx, node_count) = *region;
            let num_gns = node_count / gn_length;
            let region_key = format!("{}-{}", parent_node.tag_name, start_idx);

            if processed_region_keys.contains(&region_key) {
                continue;
            }

            let mut merged = false;

            // Adjacent region merging
            if gn_length > 1 && region_index + 1 < sorted_regions.len() {
                let next_region = &sorted_regions[region_index + 1];
                let (next_gn_length, next_start_idx, _) = *next_region;

                if start_idx + node_count == next_start_idx && gn_length == next_gn_length {
                    let current_gns = &children[start_idx..start_idx + gn_length];
                    let next_gns = &children[next_start_idx..next_start_idx + next_gn_length];

                    if !current_gns.is_empty() && !next_gns.is_empty() {
                        if get_normalized_edit_distance_sequences(current_gns, next_gns) <= t {
                            if would_produce_non_contiguous(current_gns, t) 
                                && would_produce_non_contiguous(next_gns, t) {
                                merged = true;
                                let mut merged_records_non_contiguous: Vec<DataRecord> = Vec::new();
                                let components: Vec<TagNodeRef> = current_gns.iter()
                                    .chain(next_gns.iter())
                                    .cloned()
                                    .collect();
                                
                                let num_components = components.len();
                                if num_components > 0 {
                                    let child_count = get_children(&components[0]).len();
                                    for c_idx in 0..child_count {
                                        let mut record_group: Vec<TagNodeRef> = Vec::new();
                                        for comp_idx in 0..num_components {
                                            let comp_children = get_children(&components[comp_idx]);
                                            if c_idx < comp_children.len() {
                                                record_group.push(comp_children[c_idx].clone());
                                            }
                                        }
                                        if !record_group.is_empty() {
                                            merged_records_non_contiguous.push(DataRecord::Multi(record_group));
                                        }
                                    }
                                }
                                all_records.extend(merged_records_non_contiguous);
                                processed_region_keys.insert(format!("{}-{}", 
                                    parent_node.tag_name, next_start_idx));
                            }
                        }
                    }
                }
            }

            if merged {
                processed_region_keys.insert(region_key);
                continue;
            }

            // Standard identification
            for i in 0..num_gns {
                let gn_start_index = start_idx + i * gn_length;
                let generalized_node_components = &children[gn_start_index..gn_start_index + gn_length];
                
                if generalized_node_components.is_empty() {
                    continue;
                }

                let identified_records: Vec<DataRecord> = if gn_length == 1 {
                    find_records1(&generalized_node_components[0], t)
                        .into_iter()
                        .map(DataRecord::Single)
                        .collect()
                } else {
                    find_records_n(generalized_node_components, t)
                };
                
                all_records.extend(identified_records);
            }
            processed_region_keys.insert(region_key);
        }
    }

    all_records
}

/// Find orphan records
pub fn find_orphan_records(
    regions: &[RegionsMapItem],
    t: f32,
    root: &TagNodeRef,
) -> Vec<TagNodeRef> {
    let mut found_orphans = Vec::new();

    for region_item in regions {
        if region_item.regions.is_empty() {
            continue;
        }

        let parent_node = match get_node_by_xpath(root, &region_item.parent_xpath) {
            Some(node) => node,
            None => continue,
        };

        let children = get_children(&parent_node);
        let n = children.len();
        let mut covered_indices = HashSet::new();

        for region in &region_item.regions {
            let (_, start_idx, node_count) = *region;
            for i in 0..node_count {
                covered_indices.insert(start_idx + i);
            }
        }

        let orphan_indices: Vec<usize> = (0..n)
            .filter(|i| !covered_indices.contains(i))
            .collect();

        if orphan_indices.is_empty() {
            continue;
        }

        let (repr_gn_length, repr_start_idx, _) = region_item.regions[0];
        let representative_gn = &children[repr_start_idx..repr_start_idx + repr_gn_length];
        
        if representative_gn.is_empty() {
            continue;
        }

        let representative_record_node = &representative_gn[0];
        let representative_record_string = flatten_subtree(representative_record_node);
        
        if representative_record_string.is_empty() {
            continue;
        }

        for orphan_idx in orphan_indices {
            let orphan_node = &children[orphan_idx];
            
            // Compare children of orphan
            for orphan_child in get_children(orphan_node) {
                let orphan_child_string = flatten_subtree(&orphan_child);
                if !orphan_child_string.is_empty() {
                    if get_normalized_edit_distance_sequences(
                        &[orphan_child.clone()],
                        &[representative_record_node.clone()]
                    ) <= t {
                        found_orphans.push(orphan_child);
                    }
                }
            }
            
            // Compare the orphan node itself
            let orphan_node_string = flatten_subtree(orphan_node);
            if !orphan_node_string.is_empty() {
                if get_normalized_edit_distance_sequences(
                    &[orphan_node.clone()],
                    &[representative_record_node.clone()]
                ) <= t {
                    found_orphans.push(orphan_node.clone());
                }
            }
        }
    }

    found_orphans
}