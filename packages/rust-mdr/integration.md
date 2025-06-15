# Rust MDR WASM Integration Guide

## Overview
The Rust MDR implementation provides significant performance improvements over the TypeScript version:
- 3.2× faster on 10KB files
- 8.8× faster on 100KB files
- 16.6× faster on 1MB files

## Building the WASM Package

```bash
cd packages/rust-mdr
wasm-pack build --target web --out-dir pkg
```

Note: You need the `wasm32-unknown-unknown` target installed. If using rustup:
```bash
rustup target add wasm32-unknown-unknown
```

## Integration with TypeScript

### 1. Import the WASM module

```typescript
// Replace the old imports
// import { runMDR as runMDRTs } from '@/lib/utils/runMDR'

// With the new Rust WASM imports
import init, { 
  runMdrAlgorithm, 
  identifyAllDataRecords,
  findOrphanRecords,
  getNormalizedEditDistance 
} from 'rust_mdr_pkg'

// Initialize WASM once
await init()
```

### 2. Use the new functions

```typescript
// Run MDR algorithm
const regions = await runMdrAlgorithm(rootNode, K, T)

// Identify data records
const records = await identifyAllDataRecords(regions, T, rootNode)

// Find orphan records
const orphans = await findOrphanRecords(regions, T, rootNode)

// Combine results
const finalRecords = [...records]
const recordSet = new Set(records.filter(r => !Array.isArray(r)))
orphans.forEach(orphan => {
  if (!recordSet.has(orphan)) {
    finalRecords.push(orphan)
  }
})
```

### 3. Type Definitions

Add this to your types file or create a `rust_mdr_pkg.d.ts`:

```typescript
declare module 'rust_mdr_pkg' {
  export interface TagNode {
    tag_name: string
    children: TagNode[]
    raw_text?: string
    xpath: string
  }

  export type DataRegion = [number, number, number] // [gnLength, startIdx, nodeCount]
  
  export interface RegionsMapItem {
    parent_xpath: string
    regions: DataRegion[]
  }

  export type DataRecord = TagNode | TagNode[]

  export function runMdrAlgorithm(
    node: TagNode, 
    k?: number, 
    t?: number
  ): RegionsMapItem[]
  
  export function identifyAllDataRecords(
    regions: RegionsMapItem[], 
    t: number,
    root: TagNode
  ): DataRecord[]
  
  export function findOrphanRecords(
    regions: RegionsMapItem[],
    t: number,
    root: TagNode
  ): TagNode[]
  
  export function getNormalizedEditDistance(s1: string, s2: string): number
  
  export default function init(): Promise<void>
}
```

## Key Differences from TypeScript

1. **Edit Distance Algorithm**: The Rust version uses LCS-based edit distance matching the TypeScript implementation: `(len1 + len2 - 2*lcs) / ((len1 + len2) / 2)`

2. **Performance**: String flattening is cached using `RefCell<Option<String>>` to avoid repeated computation

3. **Memory Model**: Uses `Rc<RefCell<TagNode>>` for efficient tree traversal without cloning

4. **Parallel Support**: Can be built with `--features parallel` for multi-threaded execution (requires pthread support)

## Migration Checklist

- [ ] Build WASM package with `wasm-pack`
- [ ] Copy `pkg` directory to `/apps/web/public/rust_mdr_pkg/`
- [ ] Update imports in your TypeScript code
- [ ] Add type definitions
- [ ] Test with existing HTML samples
- [ ] Verify output matches TypeScript version
- [ ] Remove old TypeScript MDR implementation (optional)

## Testing

Run the existing tests with the new implementation:

```typescript
import { expect, test } from 'vitest'
import init, { runMdrAlgorithm } from 'rust_mdr_pkg'
import { runMDR as runMDRTs } from '@/lib/utils/runMDR'

beforeAll(async () => {
  await init()
})

test('Rust output matches TypeScript', () => {
  const rustOutput = runMdrAlgorithm(testNode, 10, 0.3)
  const tsOutput = runMDRTs(testNode, 10, 0.3)
  expect(rustOutput).toStrictEqual(tsOutput)
})
```