use crate::types::TagNodeRef;

pub fn get_children(node: &TagNodeRef) -> Vec<TagNodeRef> {
    node.borrow().children.clone()
}

pub fn flatten_subtree(root: &TagNodeRef) -> String {
    // Check cache first
    if let Some(cached) = &*root.borrow().flattened_cache.borrow() {
        return cached.clone();
    }
    
    let mut buf = String::with_capacity(128);
    inner_flatten(&mut buf, root);
    
    // Cache the result
    *root.borrow().flattened_cache.borrow_mut() = Some(buf.clone());
    buf
}

fn inner_flatten(out: &mut String, node: &TagNodeRef) {
    let n = node.borrow();
    
    // Opening tag
    out.push('<');
    out.push_str(&n.tag_name);
    out.push('>');
    
    // Raw text content
    if let Some(text) = &n.raw_text {
        out.push_str(text);
    }
    
    // Recursively flatten children
    for child in &n.children {
        inner_flatten(out, child);
    }
    
    // Closing tag
    out.push_str("</");
    out.push_str(&n.tag_name);
    out.push('>');
}

pub fn flatten_subtree_with_xpath(root: &TagNodeRef) -> String {
    let mut buf = String::with_capacity(256);
    inner_flatten_with_xpath(&mut buf, root);
    buf
}

fn inner_flatten_with_xpath(out: &mut String, node: &TagNodeRef) {
    let n = node.borrow();
    
    // Opening tag with xpath
    out.push('<');
    out.push_str(&n.tag_name);
    out.push_str(" xpath=\"");
    out.push_str(&n.xpath);
    out.push_str("\">");
    
    // Raw text content
    if let Some(text) = &n.raw_text {
        out.push_str(text);
    }
    
    // Recursively flatten children
    for child in &n.children {
        inner_flatten_with_xpath(out, child);
    }
    
    // Closing tag
    out.push_str("</");
    out.push_str(&n.tag_name);
    out.push('>');
}

pub fn get_node_by_xpath(root: &TagNodeRef, xpath: &str) -> Option<TagNodeRef> {
    if root.borrow().xpath == xpath {
        return Some(root.clone());
    }
    
    for child in &root.borrow().children {
        if let Some(found) = get_node_by_xpath(child, xpath) {
            return Some(found);
        }
    }
    
    None
}

pub fn count_nodes(root: &TagNodeRef) -> usize {
    let mut count = 1;
    for child in &root.borrow().children {
        count += count_nodes(child);
    }
    count
}

pub fn get_depth(root: &TagNodeRef) -> usize {
    let children = &root.borrow().children;
    if children.is_empty() {
        return 1;
    }
    
    let max_child_depth = children
        .iter()
        .map(|child| get_depth(child))
        .max()
        .unwrap_or(0);
    
    1 + max_child_depth
}