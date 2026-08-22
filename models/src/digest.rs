//! Streaming sha256 of a cached file, so a multi-gigabyte model never lands in memory.

use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;

pub fn sha256_of(path: &Path) -> std::io::Result<(String, u64)> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut size = 0u64;
    loop {
        let read = file.read(&mut buf)?;
        if read == 0 {
            break;
        }
        size += read as u64;
        hasher.update(&buf[..read]);
    }
    let hex = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    Ok((hex, size))
}
