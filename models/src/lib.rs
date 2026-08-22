//! gb-models: model-cache blackbox. Outsiders read CONTRACT.md + schema/ only.

mod cache;
mod digest;
mod error;
mod root;
mod schema;

pub use cache::Cache;
pub use error::ModelsError;
