// src/utils.rs - Utility functions
use std::path::PathBuf;

pub fn get_app_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join("MartPOS"))
}

pub fn generate_sku(prefix: &str) -> String {
    use chrono::Utc;
    format!("{}-{}", prefix, Utc::now().format("%Y%m%d%H%M%S"))
}

pub fn calculate_gst(amount: f64, rate: f64) -> (f64, f64, f64) {
    let gst_amount = (amount * rate) / 100.0;
    let cgst = gst_amount / 2.0;
    let sgst = gst_amount / 2.0;
    (gst_amount, cgst, sgst)
}

pub fn calculate_igst(amount: f64, rate: f64) -> (f64, f64, f64) {
    let igst = (amount * rate) / 100.0;
    (igst, 0.0, 0.0)
}

pub fn round_to_2dp(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}