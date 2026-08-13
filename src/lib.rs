// lib.rs
//
// Library facade so integration tests (under `tests/`) can access the same
// modules as the binary in `main.rs`. The binary entry point in `main.rs`
// re-uses these via `use mart_pos::...` so there is exactly one declaration
// site for each module.
//
// Why a lib + bin split?
//   - `cargo test --test <name>` compiles each file in `tests/` as a separate
//     crate that depends on this library. Without a lib, integration tests
//     would have no way to `use mart_pos::database::models::User;`.
//   - Unit tests (`#[cfg(test)] mod tests`) still work in a pure binary crate,
//     but ts-rs type export is best driven from an integration test so it
//     runs as a separate, named test target that `pnpm gen-types` can call.
//
// The binary stays in `main.rs` and simply re-exports via `use mart_pos::...`
// so the Tauri `tauri::generate_handler!` macro can still find the commands.

pub mod commands;
pub mod database;
pub mod utils;
