use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TagNode {
    pub tag_name: String,
    pub children: Vec<TagNodeRef>,
    pub raw_text: Option<String>,
    pub xpath: String,

    #[serde(skip)]
    #[serde(default)]
    pub flattened_cache: RefCell<Option<String>>,
}

pub type TagNodeRef = Rc<RefCell<TagNode>>;

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

impl TagNode {
    pub fn new(tag_name: String, xpath: String) -> Self {
        TagNode {
            tag_name,
            children: Vec::new(),
            raw_text: None,
            xpath,
            flattened_cache: RefCell::new(None),
        }
    }

    pub fn add_child(&mut self, child: TagNodeRef) {
        self.children.push(child);
    }

    pub fn set_raw_text(&mut self, text: String) {
        self.raw_text = Some(text);
    }
}