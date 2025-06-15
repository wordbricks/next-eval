# Rust MDR Implementation

A high-performance Rust + WASM implementation of the MDR (Mining Data Records) algorithm, providing significant speed improvements over the TypeScript version.

## Performance

Benchmarked improvements over TypeScript implementation:
- **10KB files**: 3.2× faster
- **100KB files**: 8.8× faster  
- **1MB files**: 16.6× faster

## Architecture

### Core Modules

- **types.rs**: Core data structures with serde support
  - `TagNode`: Tree node representation with caching
  - `DataRegion`: Tuple representing region boundaries
  - `DataRecord`: Single or multiple tag nodes

- **tree_utils.rs**: Tree traversal and manipulation
  - Efficient string flattening with caching
  - XPath-based node lookup

- **similarity.rs**: LCS-based edit distance matching TypeScript
  - Formula: `(len1 + len2 - 2*lcs) / ((len1 + len2) / 2)`
  - Optimized for DOM tree comparison

- **mdr_algorithm.rs**: Core MDR algorithm
  - `ident_drs`: Identifies data regions
  - `find_drs_recursive`: Recursive region finding

- **record_extraction.rs**: Record extraction logic
  - `find_records1`: Single node record finding
  - `find_records_n`: Multi-node record finding
  - Orphan record detection

- **wasm_bindings.rs**: JavaScript interop layer

### Key Optimizations

1. **String Caching**: `RefCell<Option<String>>` prevents repeated flattening
2. **Zero-Copy References**: `Rc<RefCell<TagNode>>` for efficient tree traversal
3. **Borrow-Friendly APIs**: Minimize allocations with `&str` returns
4. **Optional Parallelism**: Feature-gated parallel execution support

## Building

```bash
# Install wasm32 target (if using rustup)
rustup target add wasm32-unknown-unknown

# Build WASM package
bun run build

# Build and deploy to web app
bun run build:deploy

# Build with parallel features
wasm-pack build --target web --out-dir pkg --features parallel
```

## Integration

### TypeScript Usage

```typescript
import { initializeRustMDR, runRustMDR } from '@/lib/utils/wasmLoaderMDR'

// Initialize once
await initializeRustMDR()

// Run MDR algorithm
const { regions, records, orphans, finalRecords } = await runRustMDR(rootNode, K, T)
```

### Direct WASM Usage

```typescript
import init, {
  runMdrAlgorithm,
  identifyAllDataRecords,
  findOrphanRecords
} from '/next-eval/rust_mdr_pkg/rust_mdr_utils.js'

await init()

const regions = runMdrAlgorithm(rootNode, K, T)
const records = identifyAllDataRecords(regions, T, rootNode)
const orphans = findOrphanRecords(regions, T, rootNode)
```

## API Reference

### runMdrAlgorithm(root, k?, t?)
Runs the MDR algorithm on a tag tree.
- `root`: Root TagNode of the HTML tree
- `k`: Maximum generalized node length (default: 10)
- `t`: Similarity threshold (default: 0.3)
- Returns: Array of RegionsMapItem

### identifyAllDataRecords(regions, t, root)
Identifies data records from regions.
- `regions`: Array of RegionsMapItem from MDR
- `t`: Similarity threshold
- `root`: Root TagNode for lookups
- Returns: Array of DataRecord

### findOrphanRecords(regions, t, root)
Finds orphan records not covered by regions.
- `regions`: Array of RegionsMapItem
- `t`: Similarity threshold
- `root`: Root TagNode
- Returns: Array of TagNode

### getNormalizedEditDistance(s1, s2)
Calculates LCS-based normalized edit distance.
- `s1`, `s2`: Strings to compare
- Returns: Number between 0 (identical) and 1 (completely different)

## Development

```bash
# Run Rust tests
cargo test

# Check code
cargo check
cargo clippy -- -D warnings

# Format code
cargo fmt
```

## Migration Notes

The Rust implementation maintains full compatibility with the TypeScript version:
- Same algorithm logic
- Identical edit distance calculation
- Compatible data structures via serde
- Drop-in replacement for existing code

The only required change is updating the import statements to use the WASM module instead of the TypeScript implementation.