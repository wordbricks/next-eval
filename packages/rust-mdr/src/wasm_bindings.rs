use wasm_bindgen::prelude::*;
use crate::mdr_algorithm::run_mdr_algorithm;
use crate::record_extraction::{identify_all_data_records_with_tree, find_orphan_records};
use crate::similarity::edit_distance;
use crate::types::{TagNodeRef, RegionsMapItem, MdrFullOutput};

/// Initialize the WASM module (called automatically)
#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better error messages in browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    // Initialize rayon thread pool if parallel feature is enabled
    #[cfg(feature = "parallel")]
    wasm_bindgen_rayon::init_thread_pool(4).expect("Rayon pool init failed");
}

/// Run the MDR algorithm on a tag tree
#[wasm_bindgen(js_name = runMdrAlgorithm)]
pub fn run_mdr_algorithm_wasm(
    root: JsValue,
    k: Option<usize>,
    t: Option<f32>,
) -> Result<JsValue, JsValue> {
    let k = k.unwrap_or(10);
    let t = t.unwrap_or(0.3);
    
    let root_node: TagNodeRef = serde_wasm_bindgen::from_value(root)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize root node: {}", e)))?;
    
    let regions = run_mdr_algorithm(&root_node, k, t);
    
    serde_wasm_bindgen::to_value(&regions)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize regions: {}", e)))
}

/// Identify all data records from regions
#[wasm_bindgen(js_name = identifyAllDataRecords)]
pub fn identify_all_data_records_wasm(
    regions_js: JsValue,
    t: f32,
    root: JsValue,
) -> Result<JsValue, JsValue> {
    let regions: Vec<RegionsMapItem> = serde_wasm_bindgen::from_value(regions_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize regions: {}", e)))?;
    
    let root_node: TagNodeRef = serde_wasm_bindgen::from_value(root)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize root node: {}", e)))?;
    
    let records = identify_all_data_records_with_tree(&regions, t, &root_node);
    
    serde_wasm_bindgen::to_value(&records)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize records: {}", e)))
}

/// Find orphan records
#[wasm_bindgen(js_name = findOrphanRecords)]
pub fn find_orphan_records_wasm(
    regions_js: JsValue,
    t: f32,
    root: JsValue,
) -> Result<JsValue, JsValue> {
    let regions: Vec<RegionsMapItem> = serde_wasm_bindgen::from_value(regions_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize regions: {}", e)))?;
    
    let root_node: TagNodeRef = serde_wasm_bindgen::from_value(root)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize root node: {}", e)))?;
    
    let orphans = find_orphan_records(&regions, t, &root_node);
    
    serde_wasm_bindgen::to_value(&orphans)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize orphans: {}", e)))
}

/// Calculate normalized edit distance between two strings (for testing/compatibility)
#[wasm_bindgen(js_name = getNormalizedEditDistance)]
pub fn get_normalized_edit_distance_wasm(s1: &str, s2: &str) -> f32 {
    edit_distance(s1, s2)
}

/// Legacy function for compatibility with existing code
#[wasm_bindgen(js_name = get_normalized_edit_distance_wasm)]
pub fn get_normalized_edit_distance_wasm_legacy(s1: &str, s2: &str) -> f32 {
    edit_distance(s1, s2)
}

/// Clear the distance cache between pages
#[wasm_bindgen(js_name = clearDistanceCache)]
pub fn clear_distance_cache() {
    use crate::similarity::NODE_DIST_CACHE;
    NODE_DIST_CACHE.clear();
}

/// End-to-end MDR: regions → records → orphans in **one** bridge call.
#[wasm_bindgen(js_name = runMdrFull)]
pub fn run_mdr_full(
    root: JsValue,
    k: Option<usize>,
    t: Option<f32>,
) -> Result<JsValue, JsValue> {
    let k = k.unwrap_or(10);
    let t = t.unwrap_or(0.3);

    let root_node: TagNodeRef = serde_wasm_bindgen::from_value(root)
        .map_err(|e| JsValue::from_str(&format!("root deserialise: {}", e)))?;

    // Step 1 – regions
    let regions = run_mdr_algorithm(&root_node, k, t);

    // Step 2 – records
    let records = identify_all_data_records_with_tree(&regions, t, &root_node);

    // Step 3 – orphans
    let orphans  = find_orphan_records(&regions, t, &root_node);

    let out = MdrFullOutput { regions, records, orphans };
    serde_wasm_bindgen::to_value(&out)
        .map_err(|e| JsValue::from_str(&format!("serialise full: {}", e)))
}