use crate::types::TagNodeRef;

pub fn get_children(node: &TagNodeRef) -> Vec<TagNodeRef> {
    node.children.clone()
}

pub fn flatten_subtree(root: &TagNodeRef) -> String {
    // Cached?
    if let Some(cached) = &*root.flattened_cache.lock() {
        return cached.clone();
    }

    let mut buf: Vec<u8> = Vec::with_capacity(128);
    inner_flatten(&mut buf, root);

    // Safety: we only push UTF-8 slices from existing Strings & ASCII literals.
    let s = unsafe { String::from_utf8_unchecked(buf) };
    *root.flattened_cache.lock() = Some(s.clone());
    s
}

fn inner_flatten(out: &mut Vec<u8>, node: &TagNodeRef) {
    // Match TypeScript logic exactly:
    // If text node with non-empty trimmed content, return empty
    if node.tag_name == "text" {
        if let Some(raw_text) = &node.raw_text {
            if !raw_text.trim().is_empty() {
                return; // Ignore text content for structural comparison
            }
        }
    }

    // Opening tag  "<tag>"
    out.extend_from_slice(b"<");
    out.extend_from_slice(node.tag_name.as_bytes());
    out.extend_from_slice(b">");

    // Children
    for child in &node.children {
        inner_flatten(out, child);
    }

    // Closing tag "</tag>" - but NOT for text nodes (matching TypeScript)
    if node.tag_name != "text" {
        out.extend_from_slice(b"</");
        out.extend_from_slice(node.tag_name.as_bytes());
        out.extend_from_slice(b">");
    }
}

pub fn flatten_subtree_with_xpath(root: &TagNodeRef) -> String {
    let mut buf = String::with_capacity(256);
    inner_flatten_with_xpath(&mut buf, root);
    buf
}

fn inner_flatten_with_xpath(out: &mut String, node: &TagNodeRef) {
    // Opening tag with xpath
    out.push('<');
    out.push_str(&node.tag_name);
    out.push_str(" xpath=\"");
    out.push_str(&node.xpath);
    out.push_str("\">");

    // Raw text content
    if let Some(text) = &node.raw_text {
        out.push_str(text);
    }

    // Recursively flatten children
    for child in &node.children {
        inner_flatten_with_xpath(out, child);
    }

    // Closing tag
    out.push_str("</");
    out.push_str(&node.tag_name);
    out.push('>');
}

pub fn get_node_by_xpath(root: &TagNodeRef, xpath: &str) -> Option<TagNodeRef> {
    if root.xpath == xpath {
        return Some(root.clone());
    }

    for child in &root.children {
        if let Some(found) = get_node_by_xpath(child, xpath) {
            return Some(found);
        }
    }

    None
}

pub fn count_nodes(root: &TagNodeRef) -> usize {
    let mut count = 1;
    for child in &root.children {
        count += count_nodes(child);
    }
    count
}

pub fn get_depth(root: &TagNodeRef) -> usize {
    let children = &root.children;
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
