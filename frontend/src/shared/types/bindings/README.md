# TypeScript Bindings (auto-generated)

This folder contains TypeScript interfaces generated from the Rust source in
`src/database/models.rs` by the [`ts-rs`](https://crates.io/crates/ts-rs) crate.

## What's here

After running `pnpm gen-types` (which invokes `cargo test --test export_types`),
this folder is populated with one `.ts` file per Rust struct, e.g.:

- `User.ts`
- `Product.ts`
- `ProductWithDetails.ts`
- `SalesInvoice.ts`
- `SalesInvoiceItem.ts`
- … and ~30 more.

Each file is overwritten on every `gen-types` run, so any manual edits will be
lost. To change a type, edit the Rust struct in `src/database/models.rs` and
re-run `pnpm gen-types`.

## Why the folder is in `.gitignore`

Generated files are a build artifact, not source code. Committing them would
cause noisy PR diffs every time the Rust models change. The folder is
`.gitkeep`'d so the path exists on a fresh clone; the actual `.ts` files
appear only after `pnpm gen-types`.

## How the frontend uses these

Two parallel surfaces coexist in `frontend/src/shared/types/`:

| Surface | When to use |
|---------|-------------|
| `index.ts` (hand-written) | Existing code. Has stricter union types like `payment_mode: 'cash' \| 'card' \| 'upi' \| 'credit' \| 'mixed'` that ts-rs can't infer from a `String` column. |
| `bindings/*.ts` (generated) | New code that wants to track the Rust shape exactly. Will fail compilation if a field has been added on the Rust side but the frontend hasn't been regenerated — which is the point: it makes schema drift impossible to miss. |

To migrate an existing import from hand-written to generated, change:

```ts
import { Product } from '@/shared/types'                    // hand-written
// to
import type { Product } from '@/shared/types/bindings'      // generated
```

…after running `pnpm gen-types` once.

## Regenerating

```bash
# from the repo root
pnpm install           # if node_modules isn't present
pnpm gen-types         # runs `cargo test --test export_types -- --nocapture`
```

The generator test is in `tests/export_types.rs`. To add a new type to the
export list, append `YourStruct::export().expect("…")` to that file.
