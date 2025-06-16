use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug)]
pub struct TagNode {
    #[serde(rename = "tag")]
    pub tag_name: String,
    pub children: Vec<TagNodeRef>,
    #[serde(rename = "rawText")]
    pub raw_text: Option<String>,
    pub xpath: String,

    #[serde(skip)]
    #[serde(default = "default_mutex")]
    pub flattened_cache: Mutex<Option<String>>,
}

fn default_mutex() -> Mutex<Option<String>> {
    Mutex::new(None)
}

pub type TagNodeRef = Arc<TagNode>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegionsMapItem {
    pub parent_xpath: String,
    pub regions: Vec<DataRegion>,
}

pub type DataRegion = (usize, usize, usize); // (gn_len, start_idx, node_cnt)

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum DataRecord {
    Single(TagNodeRef),
    Multi(Vec<TagNodeRef>),
}

/// Helper struct for the "single-call" pathway
#[derive(Serialize)]
pub struct MdrFullOutput {
    pub regions: Vec<RegionsMapItem>,
    pub records: Vec<DataRecord>,
    pub orphans: Vec<TagNodeRef>,
}

impl Clone for TagNode {
    fn clone(&self) -> Self {
        TagNode {
            tag_name: self.tag_name.clone(),
            children: self.children.clone(),
            raw_text: self.raw_text.clone(),
            xpath: self.xpath.clone(),
            flattened_cache: Mutex::new(None), // Don't clone the cache
        }
    }
}

impl TagNode {
    pub fn new(tag_name: String, xpath: String) -> Self {
        TagNode {
            tag_name,
            children: Vec::new(),
            raw_text: None,
            xpath,
            flattened_cache: Mutex::new(None),
        }
    }

    pub fn add_child(&mut self, child: TagNodeRef) {
        self.children.push(child);
    }

    pub fn set_raw_text(&mut self, text: String) {
        self.raw_text = Some(text);
    }
}
