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
